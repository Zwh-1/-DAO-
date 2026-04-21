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
import { requireAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { maskAddress } from "../security.js";
import { config } from "../config.js";
import {
  getGuardianStatus,
  getAuditLog,
  setSystemPaused,
  banAddress,
  getMemberRoles,
  setMemberRoles,
  listBlacklistEntries,
} from "../storage.js";

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

export default router;
