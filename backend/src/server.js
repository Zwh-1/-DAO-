/**
 * server.js
 * TrustID 后端服务器入口文件
 * 
 * 职责：
 *   - 中间件配置
 *   - 路由注册
 *   - 服务器启动
 * 
 * 架构说明：
 *   - 所有业务逻辑已抽离到 routes/* 路由文件
 *   - 所有服务逻辑位于 services/* 服务文件
 *   - 所有存储逻辑位于 storage.js 和 db/* 数据库文件
 */

import cors from "cors";
import express from "express";
import { verifyMessage } from "ethers";
import path from "path";

import { errorHandler, asyncHandler } from "./utils/errors.js";
import { warn, error as logError, info, httpLog } from "./utils/logger.js";
import { isAddressBanned, isSystemPaused } from "./storage.js";

import {
  config,
  isOnchainRelayEnabled,
  validateConfig,
  getAnonymousClaimEnvSummary,
} from "./config.js";
import { mintNonce, consumeNonce, extractNonceFromSiweMessage } from "./auth/nonce-store.js";
import { signJwt } from "./auth/jwt.js";
import { pickActiveRole } from "./auth/active-role.js";
import { requireAuth } from "./middleware/auth.js";
import { getPool, countNullifiers } from "./db/pool.js";
import {
  getOrCreateMemberProfile,
  getMemberRoles,
  getUsedNullifierCount,
} from "./storage.js";
import {
  getRolesSource,
  resolveRolesFromChain,
  mergeRolesFromChainAndMemory,
} from "./chain/roles.js";
import { autoMintSBT } from "./services/identity/identity.service.js";

// 导入路由模块
import identityRoutes from "./routes/identity/identity.routes.js";
import anonymousClaimRoutes from "./routes/claim/anonymousClaim.routes.js";
import channelRoutes from "./routes/channel/channel.routes.js";
import reputationRoutes from "./routes/member/reputation.routes.js";
import multiSigRoutes from "./routes/channel/multiSig.routes.js";
import claimRoutes from "./routes/claim/claim.routes.js";
import oracleRoutes from "./routes/governance/oracle.routes.js";
import guardianRoutes from "./routes/governance/guardian.routes.js";
import governanceRoutes from "./routes/governance/governance.routes.js";
import aiRoutes from "./routes/ai/ai.routes.js";
import securityRoutes from "./routes/security/security.routes.js";
import memberRoutes from "./routes/member/member.routes.js";
import explorerRoutes from "./routes/explorer/explorer.routes.js";
import zkRoutes from "./routes/identity/zk.routes.js";
import challengeRoutes from "./routes/claim/challenge.routes.js";
import auditRoutes from "./routes/audit/audit.routes.js";
import { V1Mount, V1Routes, ROOT_HEALTH_PATH } from "./config/v1Mounts.js";
import { startActivityWatcher, recordPlatformActivity } from "./services/member/activityWatcher.service.js";

const app = express();
const port = config.port;

// ── 中间件配置 ──────────────────────────────────────────────────────────────

// CORS：支持通过 CORS_ORIGINS 环境变量配置允许的源（逗号分隔），未配置则允许全部
const corsOrigins = process.env.CORS_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins, credentials: true } : undefined));
app.use(express.json({ limit: "1mb" }));

// 静态文件服务：上传的证据文件
const uploadsDir = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir, {
  maxAge: "1d", // 缓存 1 天
  fallthrough: false, // 文件不存在时返回 404
}));

// ── 请求日志（非生产环境打印精简摘要，生产环境可由反向代理/侧车采集） ────────
app.use((req, _res, next) => {
  const start = Date.now();
  const originalEnd = _res.end;
  _res.end = function (...args) {
    const duration = Date.now() - start;
    const status = _res.statusCode;
    httpLog(req.method, req.originalUrl, status, duration, {
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      uid: req.auth?.address,
    });
    originalEnd.apply(this, args);
  };
  next();
});

// ── 全局安全守卫：封禁地址拦截 ───────────────────────────────────────────────
app.use((req, res, next) => {
  const addr = req.auth?.address || req.body?.address || "";
  if (addr && isAddressBanned(addr)) {
    return res.status(403).json({ code: 9010, error: "该地址已被封禁" });
  }
  next();
});

/** Docker / 运维探活（与 GET /v1/health 并存；路径见 ROOT_HEALTH_PATH） */
app.get(ROOT_HEALTH_PATH, (_req, res) => {
  res.json({ ok: true, service: "trustaid-backend" });
});

// ── 路由注册 ────────────────────────────────────────────────────────────────

// 基础路由
app.use(V1Mount.identity, identityRoutes);
app.use(V1Mount.anonymousClaim, anonymousClaimRoutes);
app.use(V1Mount.channel, channelRoutes);
app.use(V1Mount.reputation, reputationRoutes);
app.use(V1Mount.multisig, multiSigRoutes);

// 新增路由模块
app.use(V1Mount.claim, claimRoutes);
app.use(V1Mount.oracle, oracleRoutes);
app.use(V1Mount.guardian, guardianRoutes);
app.use(V1Mount.governance, governanceRoutes);
app.use(V1Mount.ai, aiRoutes);
app.use(V1Mount.security, securityRoutes);
app.use(V1Mount.member, memberRoutes);
app.use(V1Mount.challenge, challengeRoutes);
app.use(V1Mount.explorer, explorerRoutes);
app.use(V1Mount.audit, auditRoutes);
app.use(V1Mount.zk, zkRoutes);

// ── 全局端点（不属于特定模块） ─────────────────────────────────────────────

/**
 * GET /v1/health
 * 健康检查端点（增强版）
 * 
 * 响应：
 *   - ok: 服务状态
 *   - service: 服务名称
 *   - status: 健康状态
 *   - usedNullifiers: 已使用的 Nullifier 数量
 *   - onchainRelay: 链上中继状态
 *   - timestamp: 时间戳
 *   - memory: 内存使用情况（MB）
 *   - database: 数据库连接池状态
 *   - uptime: 服务运行时间（秒）
 */
app.get(V1Routes.health, async (_, res) => {
  const p = getPool();
  const usedNullifiers = p ? await countNullifiers() : getUsedNullifierCount();
  
  // 内存使用情况
  const memUsage = process.memoryUsage();
  const memoryInfo = {
    rss: Math.round(memUsage.rss / 1024 / 1024), // 常驻集大小（MB）
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // 堆使用量（MB）
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // 堆总量（MB）
    external: Math.round(memUsage.external / 1024 / 1024), // V8 外部内存（MB）
  };
  
  // 数据库连接池状态
  let poolInfo = null;
  if (p && p.pool) {
    poolInfo = {
      activeConnections: p.pool._allConnections?.length || 0,
      freeConnections: p.pool._freeConnections?.length || 0,
      queueLength: p.pool._connectionQueue?.length || 0,
    };
  }
  
  // 服务运行时间
  const uptimeSeconds = Math.floor(process.uptime());
  
  res.json({
    ok: true,
    service: "trustaid-backend",
    status: "ok",
    usedNullifiers,
    onchainRelay: isOnchainRelayEnabled(),
    timestamp: Date.now(),
    memory: memoryInfo,
    database: poolInfo,
    uptime: uptimeSeconds,
  });
});

/**
 * GET /v1/health/detailed
 * 详细健康检查（包含更多诊断信息）
 * 
 * 响应：
 *   - 包含 /v1/health 的所有字段
 *   - nodeVersion: Node.js 版本
 *   - platform: 操作系统平台
 *   - config: 配置状态（脱敏）
 */
app.get(V1Routes.healthDetailed, async (_, res) => {
  const p = getPool();
  const usedNullifiers = p ? await countNullifiers() : getUsedNullifierCount();
  
  // 内存使用情况
  const memUsage = process.memoryUsage();
  const memoryInfo = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
    heapUsagePercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2),
  };
  
  // 数据库连接池状态
  let poolInfo = null;
  if (p && p.pool) {
    poolInfo = {
      activeConnections: p.pool._allConnections?.length || 0,
      freeConnections: p.pool._freeConnections?.length || 0,
      queueLength: p.pool._connectionQueue?.length || 0,
      usagePercent: ((p.pool._allConnections?.length || 0) / 10 * 100).toFixed(2),
    };
  }
  
  // 系统信息
  const systemInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
  };
  
  // 配置状态（脱敏）
  const configStatus = {
    databaseConfigured: !!config.databaseUrl,
    jwtConfigured: !!config.jwtSecret,
    adminTokenConfigured: !!config.adminToken,
    bypassAuth: config.bypassAuth,
    nodeEnv: config.nodeEnv,
  };
  
  res.json({
    ok: true,
    service: "trustaid-backend",
    status: "ok",
    usedNullifiers,
    onchainRelay: isOnchainRelayEnabled(),
    timestamp: Date.now(),
    memory: memoryInfo,
    database: poolInfo,
    uptime: Math.floor(process.uptime()),
    system: systemInfo,
    config: configStatus,
  });
});

/**
 * GET /v1/auth/nonce
 * 获取认证 Nonce（用于 SIWE 签名）
 * 
 * 响应：
 *   - nonce: 一次性随机数
 */
app.get(V1Routes.auth.nonce, (_, res) => {
  return res.json({ nonce: mintNonce() });
});

/**
 * POST /v1/auth/verify
 * 验证 SIWE 签名并颁发 JWT Token
 * 
 * 请求体：
 *   - message: SIWE 消息
 *   - signature: 签名
 * 
 * 响应：
 *   - token: JWT Token
 *   - address: 钱包地址
 *   - roles: 角色列表
 *   - expiresAt: 过期时间
 */
app.post(V1Routes.auth.verify, async (req, res) => {
  const { message, signature } = req.body || {};
  
  if (!message || !signature) {
    return res.status(400).json({ 
      code: 4001, 
      error: "message/signature 必填" 
    });
  }
  
  const nonce = extractNonceFromSiweMessage(message);
  if (!nonce || !consumeNonce(nonce)) {
    return res.status(400).json({ 
      code: 1001, 
      error: "nonce 无效或过期" 
    });
  }
  
  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return res.status(400).json({ 
      code: 1001, 
      error: "Invalid_Signature" 
    });
  }
  
  const address = recovered.toLowerCase();
  const exp = Date.now() + 24 * 3600 * 1000;
  
  getOrCreateMemberProfile(address);
  autoMintSBT(address).catch(err => warn(`[auth] autoMintSBT: ${err?.message}`));
  let roles = getMemberRoles(address);
  const src = getRolesSource();

  try {
    if (src === "chain" || src === "chain_with_memory_fallback") {
      const chainRoles = await resolveRolesFromChain(address);
      if (src === "chain") {
        roles = chainRoles;
      } else {
        roles = mergeRolesFromChainAndMemory(chainRoles, roles);
      }
    }
  } catch (err) {
    warn('[auth/verify] resolveRolesFromChain', { error: err?.message || String(err) }, 'auth');
    if (src === "chain") {
      return res.status(503).json({
        code: 5031,
        error: "链上角色解析失败",
        hint: String(err?.message || err),
      });
    }
    // chain_with_memory_fallback：保持内存 roles
  }

  const activeRole = pickActiveRole(roles, null);
  const token = signJwt({ address, roles, exp, activeRole }, config.jwtSecret);

  // 记录登录活动
  recordPlatformActivity(address, "SIWE_LOGIN", "完成钱包签名登录（SIWE）").catch(() => {});

  return res.json({ token, address, roles, activeRole, expiresAt: exp });
});

/**
 * POST /v1/auth/refresh-roles
 * 按当前 ROLES_SOURCE 重新解析角色并签发新 JWT（链上 grant/revoke 后调用）
 */
app.post(V1Routes.auth.refreshRoles, requireAuth, async (req, res) => {
  const address = String(req.auth.address).toLowerCase();
  let roles = getMemberRoles(address);
  const src = getRolesSource();

  try {
    if (src === "chain" || src === "chain_with_memory_fallback") {
      const chainRoles = await resolveRolesFromChain(address);
      if (src === "chain") {
        roles = chainRoles;
      } else {
        roles = mergeRolesFromChainAndMemory(chainRoles, roles);
      }
    }
  } catch (err) {
    warn('[auth/refresh-roles] resolveRolesFromChain', { error: err?.message || String(err) }, 'auth');
    if (src === "chain") {
      return res.status(503).json({
        code: 5031,
        error: "链上角色解析失败",
        hint: String(err?.message || err),
      });
    }
  }

  const exp = Date.now() + 24 * 3600 * 1000;
  const activeRole = pickActiveRole(roles, req.auth.activeRole);
  const token = signJwt({ address, roles, exp, activeRole }, config.jwtSecret);
  return res.json({ token, address, roles, activeRole, expiresAt: exp, rolesSource: src });
});

/**
 * POST /v1/auth/active-role
 * 切换当前身份（仅可在 JWT roles 内选择）；重签 JWT 使服务端与客户端一致
 */
app.post(V1Routes.auth.activeRole, requireAuth, (req, res) => {
  const next = req.body?.activeRole ?? req.body?.role;
  const roles = req.auth.roles ?? [];
  if (next == null || next === "") {
    return res.status(400).json({ code: 4001, error: "activeRole 必填" });
  }
  if (!roles.includes(String(next))) {
    return res.status(403).json({
      code: 4003,
      error: "无权使用该身份",
      hint: "activeRole 必须在当前 JWT 的 roles 内",
    });
  }
  const address = String(req.auth.address).toLowerCase();
  const exp = Date.now() + 24 * 3600 * 1000;
  const activeRole = String(next);
  const token = signJwt({ address, roles, exp, activeRole }, config.jwtSecret);
  return res.json({ token, address, roles, activeRole, expiresAt: exp });
});

/**
 * POST /v1/auth/cookie — 预留契约：未来可由服务端设置 HttpOnly Cookie。
 * 当前不落 Set-Cookie，会话仍以 Authorization Bearer 为准（与前端 AuthContext 占位调用对齐）。
 */
app.post(V1Routes.auth.cookie, requireAuth, (_req, res) => {
  res.json({
    ok: true,
    httpOnlyConfigured: false,
    message: "HttpOnly Cookie 尚未启用；请继续使用 Authorization Bearer",
  });
});

// ── 系统暂停守卫（写操作） ───────────────────────────────────────────────────

/**
 * 系统暂停时拦截所有非 GET/OPTIONS 请求（守护者手动触发的全局熔断）。
 * GET 与 OPTIONS 放行以保证健康检查和 CORS preflight。
 */
app.use((req, res, next) => {
  if (isSystemPaused() && req.method !== "GET" && req.method !== "OPTIONS") {
    return res.status(503).json({
      code: 5030,
      error: "系统暂停中（Guardian Circuit Breaker），写操作暂时不可用",
    });
  }
  next();
});

// ── 404 回退 ─────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    code: 4040,
    error: `Cannot ${_req.method} ${_req.originalUrl}`,
  });
});

// ── 全局错误处理（AppError 与未知异常统一响应） ───────────────────────────────
app.use(errorHandler);

// ── 服务器启动 ──────────────────────────────────────────────────────────────

// 仅在非测试环境下启动服务器
if (process.env.NODE_ENV !== "test") {
  if (process.env.NODE_ENV === "production") {
    try {
      validateConfig();
    } catch (err) {
      logError('[trustaid-backend] 配置校验失败，进程退出', { error: err?.message || String(err) });
      process.exit(1);
    }
  }
  const server = app.listen(port, () => {
    info(`[trustaid-backend] listening on http://localhost:${port}`);
    const ac = getAnonymousClaimEnvSummary();
    info(
      `[trustaid-backend] anonymous_claim: 链上只读=${ac.chainReadOk} 中继代播=${ac.relayOk}（见 docs/ZK申领端到端.md）`
    );
    info(
      `[trustaid-backend] database: ${config.databaseUrl?.trim() ? "DATABASE_URL 已配置 (mysql2)" : "未配置（Nullifier/claim 双写走内存兜底）"}`
    );
    if (corsOrigins?.length) {
      info(`[trustaid-backend] CORS origins: ${corsOrigins.join(", ")}`);
    }
    // 启动链上事件同步
    startActivityWatcher();
  });

  // ── 优雅退出（SIGTERM / SIGINT） ──────────────────────────────────────────
  function gracefulShutdown(signal) {
    info(`[trustaid-backend] 收到 ${signal}，开始优雅退出...`);
    server.close(async () => {
      // 关闭数据库连接池
      try {
        const p = getPool();
        if (p) {
          await p.end();
          info('[trustaid-backend] 数据库连接池已关闭');
        }
      } catch (e) {
        warn('[trustaid-backend] 关闭数据库连接池失败', { error: e.message });
      }
      info('[trustaid-backend] 已退出');
      process.exit(0);
    });
    // 超时强制退出
    setTimeout(() => {
      logError('[trustaid-backend] 优雅退出超时，强制退出');
      process.exit(1);
    }, 10_000);
  }
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export default app;
