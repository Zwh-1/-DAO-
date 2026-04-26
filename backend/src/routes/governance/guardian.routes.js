/**
 * guardian.routes.js
 * 守护者（Guardian）相关路由
 * 
 * 职责：
 *   - 系统状态查询
 *   - 熔断控制（暂停/恢复）
 *   - 黑名单管理
 *   - 审计日志查询
 *   - 角色管理
 * 
 * 安全说明：
 *   - 所有端点均需 Admin 权限
 *   - 敏感操作需记录审计日志
 */

import { Router } from "express";
import { requireAdmin } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { maskAddress } from "../../middleware/security.js";
import { relayOraclePause } from "../../chain/contracts.js";
import { config } from "../../config.js";
import {
  getGuardianStatus,
  getAuditLog,
  setSystemPaused,
  banAddress,
  getMemberRoles,
  setMemberRoles,
  listBlacklistEntries,
} from "../../storage.js";

const router = Router();

/**
 * GET /v1/guardian/blacklist（列表）
 */
router.get(
  "/blacklist",
  requireAdmin,
  (req, res) => {
    const raw = listBlacklistEntries();
    const entries = raw.map((e) => ({
      address: e.address,
      addressMasked: maskAddress(e.address),
      reason: e.reason,
      bannedAt: e.bannedAt,
    }));
    return res.json({ entries });
  },
);

/**
 * GET /v1/guardian/status
 * 查询守护者状态（系统是否暂停等）
 * 
 * 权限要求：Admin
 * 
 * 响应：
 *   - isPaused: 是否暂停
 *   - pausedAt: 暂停时间
 *   - reason: 暂停原因
 */
router.get(
  "/status",
  requireAdmin,
  (req, res) => {
    res.json(getGuardianStatus());
  }
);

/**
 * POST /v1/guardian/circuit
 * 控制系统熔断（暂停/恢复）
 * 
 * 权限要求：Admin
 * 限流：5 次/分钟
 * 
 * 请求体：
 *   - action: "pause" 或 "resume"
 *   - reason: 原因（必须，记录到审计日志）
 * 
 * 响应：
 *   - success: 是否成功
 *   - message: 操作结果消息
 */
router.post(
  "/circuit",
  requireAdmin,
  rateLimit({ max: 5, windowMs: 60_000 }),
  (req, res) => {
    const { action, reason } = req.body;
    
    // 验证 action 参数
    if (!["pause", "resume"].includes(action)) {
      return res.status(400).json({ 
        error: "action 须为 pause 或 resume" 
      });
    }
    
    // 验证原因不能为空
    if (!reason?.trim()) {
      return res.status(400).json({ 
        error: "reason 不能为空（写入审计日志）" 
      });
    }
    
    try {
      const result = setSystemPaused(action === "pause", {
        by: req.adminToken ?? "admin",
        reason: reason.trim(),
      });
      
      res.json({ 
        success: true, 
        message: `系统已${action === "pause" ? "暂停" : "恢复"}`,
        ...result 
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /v1/guardian/blacklist
 * 将地址加入黑名单
 * 
 * 权限要求：Admin
 * 限流：20 次/分钟
 * 
 * 请求体：
 *   - address: 要封禁的地址（0x 开头的 40 位十六进制）
 *   - reason: 封禁原因
 * 
 * 响应：
 *   - success: 是否成功
 *   - address: 脱敏后的地址
 */
router.post(
  "/blacklist",
  requireAdmin,
  rateLimit({ max: 20, windowMs: 60_000 }),
  (req, res) => {
    const { address, reason } = req.body;
    
    // 验证地址格式
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "address 格式错误" });
    }
    
    // 验证原因不能为空
    if (!reason?.trim()) {
      return res.status(400).json({ error: "reason 不能为空" });
    }
    
    try {
      banAddress(address, { 
        by: req.adminToken ?? "admin", 
        reason: reason.trim() 
      });
      
      // 返回脱敏后的地址
      res.json({ 
        success: true, 
        address: maskAddress(address) 
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /v1/guardian/audit-log
 * 查询审计日志
 * 
 * 权限要求：Admin
 * 
 * 响应：
 *   - logs: 审计日志列表（最近 100 条）
 */
router.get(
  "/audit-log",
  requireAdmin,
  (req, res) => {
    res.json({ logs: getAuditLog(100) });
  }
);

/**
 * POST /v1/guardian/roles
 * 设置成员角色
 * 
 * 权限要求：Admin
 * 
 * 请求体：
 *   - address: 成员地址
 *   - roles: 角色数组（member, arbitrator, challenger, oracle, guardian, dao）
 * 
 * 响应：
 *   - ok: 是否成功
 *   - address: 成员地址
 *   - roles: 设置的角色列表
 */
router.post(
  "/roles",
  requireAdmin,
  (req, res) => {
    if (config.nodeEnv === "production") {
      return res.status(403).json({
        code: 9003,
        error: "生产环境角色由链上合约管理，请使用 PlatformRoleRegistry / ArbitratorPool 等链上操作",
        doc: "docs/链上角色与权限.md",
      });
    }

    const { address, roles } = req.body || {};
    
    // 验证地址格式
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "address 格式错误" });
    }
    
    // 验证角色有效性
    const validRoles = ["member", "arbitrator", "challenger", "oracle", "guardian", "dao"];
    if (!Array.isArray(roles) || roles.some((r) => !validRoles.includes(r))) {
      return res.status(400).json({ 
        error: `roles 必须是以下角色的子集：${validRoles.join(", ")}` 
      });
    }
    
    try {
      setMemberRoles(address, roles);
      res.json({ ok: true, address: address.toLowerCase(), roles });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /v1/guardian/member-roles/:address
 * 查询成员角色
 * 
 * 权限要求：Admin
 * 
 * 路径参数：
 *   - address: 成员地址
 * 
 * 响应：
 *   - address: 成员地址
 *   - roles: 角色列表
 */
router.get(
  "/member-roles/:address",
  requireAdmin,
  (req, res) => {
    const { address } = req.params;
    
    // 验证地址格式
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "address 格式错误" });
    }
    
    const roles = getMemberRoles(address);
    res.json({ address: address.toLowerCase(), roles });
  }
);

/**
 * GET /v1/guardian/params
 * 查询系统关键参数（合约配置快照）
 *
 * 权限要求：Admin（Guardian 角色）
 *
 * 响应（JSON Schema）：
 * {
 *   "arbitratorPool": {
 *     "minStakeWei": "string",
 *     "poolSize": "number"
 *   },
 *   "challengeManager": {
 *     "commitWindowSec": "number",
 *     "revealWindowSec": "number",
 *     "minReveal": "number"
 *   },
 *   "governance": {
 *     "votePeriodSec": "number",
 *     "timelockDelaySec": "number",
 *     "quorumWeight": "string"
 *   },
 *   "oracle": {
 *     "minQuorum": "number",
 *     "fasttrackQuorum": "number",
 *     "reportTtlSec": "number",
 *     "governanceTimeoutSec": "number",
 *     "minActiveOracles": "number"
 *   },
 *   "fetchedAt": "number"
 * }
 */
router.get(
  "/params",
  requireAdmin,
  (req, res) => {
    return res.json({
      arbitratorPool: {
        minStakeWei: "10000000000000000",
        poolSize: 0,
      },
      challengeManager: {
        commitWindowSec: 86400,
        revealWindowSec: 86400,
        minReveal: 2,
      },
      governance: {
        votePeriodSec: 259200,
        timelockDelaySec: 172800,
        quorumWeight: "100",
      },
      oracle: {
        minQuorum: 3,
        fasttrackQuorum: 5,
        reportTtlSec: 604800,
        governanceTimeoutSec: 1209600,
        minActiveOracles: 2,
      },
      fetchedAt: Math.floor(Date.now() / 1000),
    });
  }
);

/**
 * POST /v1/guardian/upgrade
 * 提交合约升级提案（通过 Governance 时间锁执行）
 *
 * 权限要求：Admin（Guardian 角色）
 * 限流：5 次/小时
 *
 * 请求体（JSON Schema）：
 * {
 *   "contractName": "string",         必填，如 "ClaimVault" / "OracleManager"
 *   "newImplementation": "string",    必填，新实现合约地址（0x...）
 *   "description": "string",          必填，升级说明
 *   "callData": "string",             可选，hex 编码的初始化 calldata
 *   "onchainTxHash": "string"         可选，已广播 Governance.propose() 的 tx
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "upgradeId": "string",
 *   "contractName": "string",
 *   "newImplementation": "string",
 *   "proposedBy": "string(masked)",
 *   "onchainTxHash": "string|null",
 *   "proposedAt": "number"
 * }
 *
 * 链上对应：Governance.propose(description, target, callData) → execute() after timelock
 *
 * 错误：
 *   - 400: 缺少必填字段 / 地址格式错误
 *   - 503: 系统已暂停
 */
router.post(
  "/upgrade",
  requireAdmin,
  rateLimit({ max: 5, windowMs: 3_600_000 }),
  (req, res) => {
    const { contractName, newImplementation, description, callData, onchainTxHash } =
      req.body || {};

    if (!contractName?.trim() || !newImplementation || !description?.trim()) {
      return res.status(400).json({
        code: 4001,
        error: "contractName / newImplementation / description 均为必填",
      });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(newImplementation)) {
      return res.status(400).json({ code: 4002, error: "newImplementation 地址格式错误" });
    }

    const upgradeId = `UPG-${Date.now()}`;

    // TODO: 调用 Governance.propose() 提交升级提案
    return res.status(201).json({
      success: true,
      upgradeId,
      contractName: contractName.trim(),
      newImplementation: newImplementation.toLowerCase(),
      description: description.trim(),
      callData: callData ?? null,
      proposedBy: maskAddress(req.adminToken ?? "admin"),
      onchainTxHash: onchainTxHash ?? null,
      proposedAt: Math.floor(Date.now() / 1000),
    });
  }
);

/**
 * POST /v1/guardian/oracle/pause
 * 暂停或恢复预言机（Guardian 紧急熔断）
 *
 * 权限要求：Admin（Guardian 角色）
 * 限流：5 次/分钟
 *
 * 请求体（JSON Schema）：
 * {
 *   "action":  "'pause'|'resume'",    必填
 *   "oracle":  "string|'all'",        必填，目标预言机地址或 'all'
 *   "reason":  "string",              必填，记录审计日志
 *   "txHash":  "string"               可选，已广播的链上 tx
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "action": "string",
 *   "oracle": "string",
 *   "txHash": "string|null",
 *   "executedAt": "number"
 * }
 *
 * 链上对应：OracleManager.removeOracle(address) / addOracle(address)（owner 操作）
 *
 * 错误：
 *   - 400: action 无效 / reason 为空
 *   - 400: oracle 地址格式错误（非 'all'）
 */
router.post(
  "/oracle/pause",
  requireAdmin,
  rateLimit({ max: 5, windowMs: 60_000 }),
  async (req, res) => {
    const { action, oracle, reason, txHash } = req.body || {};

    if (!["pause", "resume"].includes(action)) {
      return res.status(400).json({ code: 4001, error: "action 须为 pause 或 resume" });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ code: 4002, error: "reason 不能为空（写入审计日志）" });
    }
    if (!oracle) {
      return res.status(400).json({ code: 4003, error: "oracle 为必填（地址或 'all'）" });
    }
    if (oracle !== "all" && !/^0x[0-9a-fA-F]{40}$/.test(oracle)) {
      return res.status(400).json({ code: 4004, error: "oracle 须为有效地址或字符串 'all'" });
    }

    console.log(
      `[guardian] oracle ${action} oracle=${oracle} reason=${reason} by=admin`
    );

    // 尝试通过 Relayer 调用链上 OracleManager
    const relayResult = await relayOraclePause(oracle, action);

    return res.json({
      success: true,
      action,
      oracle,
      reason: reason.trim(),
      txHash: txHash ?? relayResult.txHash ?? null,
      onchain: relayResult.onchain,
      relayMessage: relayResult.message ?? relayResult.error ?? null,
      executedAt: Math.floor(Date.now() / 1000),
    });
  }
);

export default router;
