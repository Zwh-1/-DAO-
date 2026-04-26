/**
 * oracle.routes.js
 * 预言机相关路由
 * 
 * 职责：
 *   - Oracle 多签报告提交
 *   - Oracle 签名
 *   - 报告查询
 */

import { createHash } from "node:crypto";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { asyncHandler } from "../../utils/errors.js";
import { getOracleStake } from "../../chain/contracts.js";
import {
  submitOracleReport,
  signOracleReport,
  getOracleReport,
  listOracleReports,
  saveOracleReport,
} from "../../storage.js";

const router = Router();

/**
 * GET /v1/oracle/reports
 * 报告列表（脱敏摘要）
 */
router.get(
  "/reports",
  requireAuth,
  requireRole("oracle"),
  (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return res.json(listOracleReports({ page, limit }));
  },
);

/**
 * POST /v1/oracle/report
 * 提交 Oracle 报告（多签）
 * 
 * 权限要求：
 *   - 已认证用户
 *   - Oracle 角色
 * 
 * 请求体：
 *   - reportId: 报告 ID
 *   - claimId: 申领 ID
 *   - ipfsCid: IPFS CID（必须以 ipfs:// 开头）
 * 
 * 响应：
 *   - success: 是否成功
 *   - report: 报告详情
 */
router.post(
  "/report",
  requireAuth,
  requireRole("oracle"),
  rateLimit({ max: 10, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    const { reportId, claimId, ipfsCid } = req.body;
    
    if (!reportId || !claimId || !ipfsCid) {
      return res.status(400).json({ error: "reportId / claimId / ipfsCid 均为必填" });
    }
    
    if (!ipfsCid.startsWith("ipfs://")) {
      return res.status(400).json({ error: "ipfsCid 必须以 ipfs:// 开头" });
    }
    
    const dataHash = createHash("sha256").update(ipfsCid).digest("hex");
    
    try {
      const report = submitOracleReport({
        reportId,
        claimId,
        dataHash,
        oracle: req.auth?.address ?? "relayer",
      });
      return res.json({ success: true, ...report });
    } catch (err) {
      if (err.code === "REPORT_EXISTS") {
        return res.status(409).json({ error: "报告已存在" });
      }
      throw err;
    }
  })
);

/**
 * POST /v1/oracle/sign
 * Oracle 签署报告
 * 
 * 权限要求：
 *   - 已认证用户
 *   - Oracle 角色
 * 
 * 请求体：
 *   - reportId: 报告 ID
 * 
 * 响应：
 *   - success: 是否成功
 *   - signature: 签名信息
 */
router.post(
  "/sign",
  requireAuth,
  requireRole("oracle"),
  rateLimit({ max: 20, windowMs: 60_000 }),
  (req, res) => {
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: "reportId 为必填" });
    }
    
    try {
      const result = signOracleReport({
        reportId,
        oracle: req.auth?.address ?? "anon",
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      // 错误码映射
      const MAP = {
        REPORT_NOT_FOUND: [404, "报告不存在"],
        REPORT_FINALIZED: [409, "报告已终结"],
        ALREADY_SIGNED: [409, "您已签名过该报告"],
      };
      const [status, msg] = MAP[err.code] ?? [500, err.message];
      return res.status(status).json({ error: msg });
    }
  }
);

/**
 * GET /v1/oracle/report/:reportId
 * 查询 Oracle 报告
 * 
 * 路径参数：
 *   - reportId: 报告 ID
 * 
 * 响应：
 *   - report: 报告详情
 */
router.get(
  "/report/:reportId",
  (req, res) => {
    const report = getOracleReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: "报告不存在" });
    }
    return res.json(report);
  }
);

/**
 * POST /v1/oracle/legacy-report
 * 提交 Oracle 报告（旧版，已弃用）
 * 
 * @deprecated 请使用 POST /v1/oracle/report
 */
router.post(
  "/legacy-report",
  requireAuth,
  requireRole("oracle"),
  asyncHandler(async (req, res) => {
    const { claimId, verdict, signature, reporter } = req.body || {};
    
    if (!claimId || !verdict || !signature) {
      return res.status(400).json({ 
        code: 4004, 
        error: "claimId/verdict/signature are required" 
      });
    }
    
    const report = saveOracleReport(claimId, verdict, signature, reporter);
    
    return res.status(201).json({
      ...report,
      deprecated: true,
      message: "This endpoint is deprecated. Please migrate to POST /v1/oracle/report with reportId/claimId/ipfsCid."
    });
  })
);

/**
 * GET /v1/oracle/stake
 * 查询预言机质押状态
 *
 * 权限要求：已认证 + Oracle 角色
 *
 * 查询参数：
 *   - address: 预言机地址（可选，默认 JWT address）
 *
 * 响应（JSON Schema）：
 * {
 *   "address": "string",
 *   "stakedWei": "string(uint256)",   当前质押金额
 *   "minStakeWei": "string(uint256)", 最低质押要求
 *   "active": "boolean",
 *   "slashedWei": "string(uint256)",  被 slash 的总金额
 *   "onchainData": "object|null"       链上原始数据（可选）
 * }
 *
 * 链上对应：OracleManager.oracleStakes(address)
 */
router.get(
  "/stake",
  requireAuth,
  requireRole("oracle"),
  asyncHandler(async (req, res) => {
    const address = String(
      req.query.address || req.auth?.address || ""
    ).toLowerCase();

    if (!address) {
      return res.status(400).json({ code: 4001, error: "address 查询参数必填" });
    }

    const chainData = await getOracleStake(address);

    return res.json({
      address,
      stakedWei: chainData.stakedWei,
      minStakeWei: chainData.minStakeWei,
      active: chainData.active,
      totalStaked: chainData.totalStaked,
      onchain: chainData.onchain,
      slashedWei: "0",  // 需要事件索引才可计算
      _hint: chainData.onchain
        ? null
        : "链上读取不可用：请配置 ORACLE_MANAGER_ADDRESS / RPC_URL",
    });
  })
);

/**
 * POST /v1/oracle/stake
 * 记录预言机质押（链上 stake() 广播后同步到后端）
 *
 * 权限要求：已认证 + Oracle 角色
 * 限流：10 次/小时
 *
 * 请求体（JSON Schema）：
 * {
 *   "stakeWei":  "string",    必填，质押金额（uint256 wei）
 *   "txHash":    "string",    必填，OracleManager.stake() 的 tx hash
 *   "oracle":    "string"     必填，预言机地址
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "oracle": "string",
 *   "stakeWei": "string",
 *   "txHash": "string",
 *   "recordedAt": "number"
 * }
 *
 * 链上对应：OracleManager.stake() payable
 *
 * 错误：
 *   - 400: stakeWei < minStake / 格式错误
 */
router.post(
  "/stake",
  requireAuth,
  requireRole("oracle"),
  rateLimit({ max: 10, windowMs: 3_600_000 }),
  asyncHandler(async (req, res) => {
    const { stakeWei, txHash, oracle } = req.body || {};
    const MIN_STAKE = 10_000_000_000_000_000n; // 0.01 ETH

    if (!stakeWei || !txHash || !oracle) {
      return res.status(400).json({
        code: 4001,
        error: "stakeWei/txHash/oracle 均为必填",
      });
    }

    let stake;
    try {
      stake = BigInt(stakeWei);
      if (stake <= 0n) throw new Error();
    } catch {
      return res.status(400).json({ code: 4002, error: "stakeWei 须为正整数字符串" });
    }

    if (stake < MIN_STAKE) {
      return res.status(400).json({
        code: 4003,
        error: `质押金额不足最低要求 ${MIN_STAKE.toString()} wei (0.01 ETH)`,
      });
    }

    // TODO: 写链上事件索引，更新 oracle 质押状态
    return res.status(201).json({
      success: true,
      oracle: oracle.toLowerCase(),
      stakeWei: stake.toString(),
      txHash,
      recordedAt: Math.floor(Date.now() / 1000),
    });
  })
);

export default router;
