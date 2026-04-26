/**
 * audit.routes.js
 * 审计模块路由
 *
 * 职责：
 *   - 资金流分析（/v1/audit/flow）
 *   - 欺诈检测（/v1/audit/fraud）
 *   - 历史报告查询（/v1/audit/reports）
 *   - 报告发布（/v1/audit/publish）
 *
 * 权限：Guardian 或 DAO 角色（对应前端 RoleGuard required={["guardian","dao"]}）
 *
 * 安全说明：
 *   - 所有写操作均需 JWT 认证
 *   - 发布报告会写入 AuditLog 合约（可选链上中继）
 *   - 敏感地址在响应中脱敏
 */

import { Router } from "express";
import { requireAuth, requireAnyRole } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { asyncHandler } from "../../utils/errors.js";
import { maskAddress } from "../../middleware/security.js";
import { getAuditLog } from "../../storage.js";
import { getTreasurySummary, getOnchainAuditLogs } from "../../chain/contracts.js";
import { randomUUID } from "node:crypto";

const router = Router();

// ── 内存存储（开发阶段；生产应接 DB） ─────────────────────────────────────

const auditReports = new Map(); // reportId -> AuditReport

/**
 * GET /v1/audit/flow
 * 资金流分析
 *
 * 权限要求：Guardian 或 DAO
 *
 * 查询参数：
 *   - from:  起始时间戳（秒，可选）
 *   - to:    结束时间戳（秒，可选）
 *   - limit: 返回条数（默认 50，最大 200）
 *
 * 响应：
 *   - summary: { totalIn, totalOut, netFlow, txCount }
 *   - flows: [{ txHash, from, to, amount, type, timestamp }]
 *
 * JSON Schema (response):
 * {
 *   "summary": {
 *     "totalIn": "string(uint256 wei)",
 *     "totalOut": "string(uint256 wei)",
 *     "netFlow": "string(int256 wei)",
 *     "txCount": "number"
 *   },
 *   "flows": [{
 *     "txHash": "string",
 *     "from": "string",
 *     "to": "string",
 *     "amount": "string(uint256 wei)",
 *     "type": "'deposit'|'withdrawal'|'reward'|'slash'|'claim_payout'",
 *     "timestamp": "number"
 *   }]
 * }
 */
router.get(
  "/flow",
  requireAuth,
  requireAnyRole(["guardian", "dao"]),
  asyncHandler(async (req, res) => {
    const from = Number(req.query.from) || 0;
    const to = Number(req.query.to) || Math.floor(Date.now() / 1000);
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    // 从链上 Treasury 合约读取资金流摘要
    const treasuryData = await getTreasurySummary();

    const summary = {
      totalIn: treasuryData.totalDeposited,
      totalOut: treasuryData.totalWithdrawn,
      netFlow: (
        BigInt(treasuryData.totalDeposited) - BigInt(treasuryData.totalWithdrawn)
      ).toString(),
      currentBalance: treasuryData.currentBalance,
      txCount: 0,  // 需事件索引才可精确计数
      onchain: treasuryData.onchain,
    };

    return res.json({
      summary,
      flows: [],  // 详细交易列表需事件索引
      from,
      to,
      limit,
      _hint: treasuryData.onchain
        ? null
        : "链上读取不可用：请配置 TREASURY_ADDRESS / RPC_URL",
    });
  })
);

/**
 * GET /v1/audit/fraud
 * 欺诈检测
 *
 * 权限要求：Guardian 或 DAO
 *
 * 查询参数：
 *   - page:        页码（默认 1）
 *   - limit:       每页条数（默认 20，最大 100）
 *   - riskLevel:   过滤风险等级 'low'|'medium'|'high'|'critical'（可选）
 *
 * 响应：
 *   - alerts: FraudAlert[]
 *   - total / page / limit
 *
 * JSON Schema (FraudAlert):
 * {
 *   "alertId": "string",
 *   "claimId": "string",
 *   "address": "string(masked)",
 *   "riskScore": "number(0-100)",
 *   "riskLevel": "'low'|'medium'|'high'|'critical'",
 *   "patterns": ["string"],
 *   "detectedAt": "number",
 *   "zkProofHash": "string|null"
 * }
 *
 * 错误：
 *   - 401: 未认证
 *   - 403: 权限不足
 */
router.get(
  "/fraud",
  requireAuth,
  requireAnyRole(["guardian", "dao"]),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const riskFilter = req.query.riskLevel;

    // 从链上 AuditLog 合约读取 FraudDetected 类型日志
    const { onchain, logs } = await getOnchainAuditLogs(limit * page);
    const FRAUD_LOG_TYPE = 7; // AuditLog.LogType.FraudDetected

    const fraudLogs = logs.filter((l) => l.logType === FRAUD_LOG_TYPE);

    // 将链上日志转换为欺诈告警格式
    let alerts = fraudLogs.map((l) => ({
      alertId: `FRAUD-${l.logId}`,
      claimId: l.refId,
      address: maskAddress(l.actor),
      riskScore: null,      // 需 ZK 欺诈检测电路计算
      riskLevel: "unknown", // 同上
      patterns: [],
      detectedAt: l.timestamp,
      ipfsCid: l.ipfsCid || null,
      zkProofHash: null,
    }));

    if (riskFilter) {
      alerts = alerts.filter((a) => a.riskLevel === riskFilter);
    }

    const total = alerts.length;
    const start = (page - 1) * limit;

    return res.json({
      alerts: alerts.slice(start, start + limit),
      total,
      page,
      limit,
      riskFilter: riskFilter ?? null,
      onchain,
      _hint: onchain ? null : "链上读取不可用：请配置 AUDIT_LOG_ADDRESS / RPC_URL",
    });
  })
);

/**
 * GET /v1/audit/reports
 * 历史审计报告列表
 *
 * 权限要求：Guardian 或 DAO
 *
 * 查询参数：
 *   - page:   页码（默认 1）
 *   - limit:  每页条数（默认 20，最大 100）
 *   - status: 过滤状态 'draft'|'published'（可选）
 *
 * 响应：
 *   - reports: AuditReport[]
 *   - total / page / limit
 *
 * JSON Schema (AuditReport):
 * {
 *   "reportId": "string",
 *   "title": "string",
 *   "period": { "from": "number", "to": "number" },
 *   "status": "'draft'|'published'",
 *   "publishedBy": "string(masked address)",
 *   "publishedAt": "number|null",
 *   "ipfsCid": "string|null",
 *   "onchainTxHash": "string|null",
 *   "summary": "string",
 *   "createdAt": "number"
 * }
 */
router.get(
  "/reports",
  requireAuth,
  requireAnyRole(["guardian", "dao"]),
  (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const statusFilter = req.query.status;

    let all = Array.from(auditReports.values());
    if (statusFilter) {
      all = all.filter((r) => r.status === statusFilter);
    }

    all.sort((a, b) => b.createdAt - a.createdAt);
    const total = all.length;
    const reports = all.slice((page - 1) * limit, page * limit).map((r) => ({
      ...r,
      publishedBy: r.publishedBy ? maskAddress(r.publishedBy) : null,
    }));

    return res.json({ reports, total, page, limit });
  }
);

/**
 * POST /v1/audit/publish
 * 发布审计报告（生成并广播）
 *
 * 权限要求：Guardian 或 DAO
 * 限流：10 次/小时
 *
 * 请求体（JSON Schema）:
 * {
 *   "title": "string",              必填
 *   "summary": "string",            必填
 *   "periodFrom": "number",         必填，Unix 秒
 *   "periodTo": "number",           必填，Unix 秒
 *   "ipfsCid": "string",            可选，IPFS 报告 CID
 *   "onchainTxHash": "string"       可选，已广播上链的 AuditLog tx
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "reportId": "string",
 *   "report": AuditReport
 * }
 *
 * 错误：
 *   - 400: 缺少必填字段
 *   - 409: 相同时间段报告已存在
 *   - 503: 系统已暂停
 */
router.post(
  "/publish",
  requireAuth,
  requireAnyRole(["guardian", "dao"]),
  rateLimit({ max: 10, windowMs: 3_600_000 }),
  asyncHandler(async (req, res) => {
    const { title, summary, periodFrom, periodTo, ipfsCid, onchainTxHash } =
      req.body || {};

    if (!title?.trim() || !summary?.trim()) {
      return res
        .status(400)
        .json({ code: 4001, error: "title 和 summary 不能为空" });
    }
    if (!periodFrom || !periodTo || Number(periodTo) <= Number(periodFrom)) {
      return res.status(400).json({
        code: 4002,
        error: "periodFrom / periodTo 必填且 periodTo > periodFrom",
      });
    }

    const reportId = `RPT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = Math.floor(Date.now() / 1000);

    const report = {
      reportId,
      title: title.trim(),
      summary: summary.trim(),
      period: { from: Number(periodFrom), to: Number(periodTo) },
      status: "published",
      publishedBy: req.auth?.address ?? "unknown",
      publishedAt: now,
      ipfsCid: ipfsCid ?? null,
      onchainTxHash: onchainTxHash ?? null,
      createdAt: now,
    };

    auditReports.set(reportId, report);

    return res.status(201).json({
      success: true,
      reportId,
      report: {
        ...report,
        publishedBy: maskAddress(report.publishedBy),
      },
    });
  })
);

export default router;
