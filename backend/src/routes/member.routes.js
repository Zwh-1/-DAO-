/**
 * member.routes.js
 * 成员相关路由
 * 
 * 职责：
 *   - 成员档案查询
 *   - 钱包绑定
 *   - 仲裁任务查询
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getOrCreateMemberProfile,
  bindWallet,
  listArbTasksByAddress,
  saveArbCommit,
  revealArbVote,
} from "../storage.js";
import { asyncHandler } from "../utils/errors.js";
import { assertSameWallet } from "../utils/auth-bind.js";
import { queryActivities } from "../services/activityWatcher.service.js";
import { calculateReputation, getReputationTrend } from "../services/memberReputation.service.js";

const router = Router();

/**
 * GET /v1/member/profile/:address
 * 查询成员档案
 * 
 * 路径参数：
 *   - address: 成员地址
 * 
 * 响应：
 *   - address: 成员地址
 *   - roles: 角色列表
 *   - creditScore: 信用分数
 *   - level: 等级
 */
router.get(
  "/profile/:address",
  (req, res) => {
    const profile = getOrCreateMemberProfile(req.params.address);
    return res.json(profile);
  }
);

/**
 * POST /v1/member/wallets/bind
 * 绑定钱包
 * 
 * 权限要求：已认证用户
 * 
 * 请求体：
 *   - mainAddr: 主钱包地址
 *   - newAddr: 新钱包地址
 *   - proof: 所有权证明
 * 
 * 响应：
 *   - success: 是否成功
 *   - binding: 绑定信息
 */
router.post(
  "/wallets/bind",
  requireAuth,
  (req, res) => {
    const { mainAddr, newAddr, proof } = req.body || {};
    
    // 验证必填字段
    if (!mainAddr || !newAddr || !proof) {
      return res.status(400).json({ 
        code: 4003, 
        error: "mainAddr/newAddr/proof are required" 
      });
    }

    if (!assertSameWallet(mainAddr, req, res, "mainAddr")) {
      return;
    }
    
    try {
      const result = bindWallet(mainAddr, newAddr, proof);
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ code: 5003, error: err.message });
    }
  }
);

/**
 * GET /v1/member/activity
 * 查询成员链上与平台活动记录
 *
 * 查询参数：
 *   - address: 成员地址（必填）
 *   - page: 页码（默认 1）
 *   - limit: 每页条数（默认 20，最大 50）
 *
 * 响应：
 *   - activities: 活动列表
 *   - total / page / limit / totalPages
 */
router.get("/activity", asyncHandler(async (req, res) => {
  const address = String(req.query.address || "").trim();
  if (!address) {
    return res.status(400).json({ code: 4001, error: "address 查询参数必填" });
  }
  const result = await queryActivities(address, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });
  return res.json(result);
}));

/**
 * GET /v1/member/reputation
 * 查询成员声誉评分与趋势
 *
 * 查询参数：
 *   - address: 成员地址（必填）
 *   - windows: 趋势窗口数（默认 7）
 *   - windowDays: 每窗口天数（默认 7）
 *
 * 响应：
 *   - score: 当前声誉分（0-1000）
 *   - breakdown: 各维度贡献
 *   - trend: 声誉趋势 [{ date, score }]
 */
router.get("/reputation", asyncHandler(async (req, res) => {
  const address = String(req.query.address || "").trim();
  if (!address) {
    return res.status(400).json({ code: 4001, error: "address 查询参数必填" });
  }
  const [rep, trend] = await Promise.all([
    calculateReputation(address),
    getReputationTrend(address, {
      windows: Number(req.query.windows) || 7,
      windowDays: Number(req.query.windowDays) || 7,
    }),
  ]);
  return res.json({ ...rep, ...trend });
}));

/**
 * GET /v1/arb/tasks/my
 * 查询我的仲裁任务
 * 
 * 查询参数：
 *   - address: 仲裁员地址
 * 
 * 响应：
 *   - tasks: 仲裁任务列表
 */
router.get("/arb/tasks/my", requireAuth, requireRole("arbitrator"), (req, res) => {
    const address = String(req.auth.address || "").toLowerCase();
    return res.json({ tasks: listArbTasksByAddress(address) });
  });

/**
 * POST /v1/arb/commit
 * 提交仲裁承诺
 * 
 * 权限要求：
 *   - 已认证用户
 *   - Arbitrator 角色
 * 
 * 请求体：
 *   - proposalId: 提案 ID
 *   - commitment: 承诺哈希
 *   - arbitrator: 仲裁员地址
 * 
 * 响应：
 *   - success: 是否成功
 *   - commit: 承诺记录
 */
router.post(
  "/arb/commit",
  requireAuth,
  requireRole("arbitrator"),
  (req, res) => {
    const { proposalId, commitment, arbitrator } = req.body || {};
    
    if (!proposalId || !commitment || !arbitrator) {
      return res.status(400).json({ 
        code: 3003, 
        error: "proposalId/commitment/arbitrator are required" 
      });
    }

    if (!assertSameWallet(arbitrator, req, res, "arbitrator")) {
      return;
    }
    
    const row = saveArbCommit(proposalId, arbitrator, commitment);
    return res.status(201).json(row);
  }
);

/**
 * POST /v1/arb/reveal
 * 揭示仲裁投票
 * 
 * 权限要求：
 *   - 已认证用户
 *   - Arbitrator 角色
 * 
 * 请求体：
 *   - proposalId: 提案 ID
 *   - choice: 选择
 *   - salt: 随机盐值
 *   - arbitrator: 仲裁员地址
 * 
 * 响应：
 *   - success: 是否成功
 *   - vote: 投票记录
 */
router.post(
  "/arb/reveal",
  requireAuth,
  requireRole("arbitrator"),
  (req, res) => {
    const { proposalId, choice, salt, arbitrator } = req.body || {};
    
    if (!proposalId || choice === undefined || !salt || !arbitrator) {
      return res.status(400).json({ 
        code: 3004, 
        error: "proposalId/choice/salt/arbitrator required" 
      });
    }

    if (!assertSameWallet(arbitrator, req, res, "arbitrator")) {
      return;
    }
    
    const row = revealArbVote(proposalId, arbitrator, choice, salt);
    return res.status(201).json(row);
  }
);

export default router;
