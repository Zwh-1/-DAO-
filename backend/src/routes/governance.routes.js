/**
 * governance.routes.js
 * DAO 治理相关路由
 * 
 * 职责：
 *   - 提案查询
 *   - 发起提案
 *   - 投票
 * 
 * 安全说明：
 *   - 发起提案需认证且限流
 *   - 投票需认证且限流
 *   - 系统暂停时禁止发起提案
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
  listProposals,
  getProposalById,
  createProposal,
  castVote,
  isSystemPaused,
} from "../storage.js";

const router = Router();

/**
 * GET /v1/governance/proposals
 * 查询所有提案
 * 
 * 响应：
 *   - proposals: 提案列表
 */
router.get(
  "/proposals",
  (req, res) => {
    res.json({ proposals: listProposals() });
  }
);

/**
 * GET /v1/governance/proposals/:id
 * 查询单个提案详情
 * 
 * 路径参数：
 *   - id: 提案 ID
 * 
 * 响应：
 *   - proposal: 提案详情
 */
router.get(
  "/proposals/:id",
  (req, res) => {
    const proposal = getProposalById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ code: 4041, error: "提案不存在" });
    }
    return res.json({ proposal });
  }
);

/**
 * POST /v1/governance/propose
 * 发起新提案
 * 
 * 权限要求：已认证用户
 * 限流：5 次/小时
 * 
 * 请求体：
 *   - description: 提案描述（不能为空）
 * 
 * 响应：
 *   - success: 是否成功
 *   - proposalId: 提案 ID
 *   - proposal: 提案详情
 * 
 * 错误处理：
 *   - 系统暂停时无法发起提案
 */
router.post(
  "/propose",
  requireAuth,
  requireRole("dao"),
  rateLimit({ max: 5, windowMs: 3_600_000 }),
  (req, res) => {
    const { description } = req.body;
    
    // 验证描述不能为空
    if (!description?.trim()) {
      return res.status(400).json({ error: "description 不能为空" });
    }
    
    // 检查系统是否暂停
    if (isSystemPaused()) {
      return res.status(503).json({ error: "系统已暂停，无法发起提案" });
    }
    
    try {
      const proposal = createProposal({
        description: description.trim(),
        proposer: req.auth?.address ?? "0x0000",
      });
      
      res.status(201).json({ 
        success: true, 
        proposalId: proposal.id, 
        proposal 
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /v1/governance/vote
 * 对提案投票
 * 
 * 权限要求：已认证用户
 * 限流：30 次/小时
 * 
 * 请求体：
 *   - proposalId: 提案 ID
 *   - support: 支持程度（0=反对，1=赞成，2=弃权）
 * 
 * 响应：
 *   - success: 是否成功
 *   - proposal: 更新后的提案
 * 
 * 错误处理：
 *   - ALREADY_VOTED: 已投票
 *   - NOT_FOUND: 提案不存在
 *   - VOTE_ENDED: 投票期已结束
 */
router.post(
  "/vote",
  requireAuth,
  requireRole("dao"),
  rateLimit({ max: 30, windowMs: 3_600_000 }),
  (req, res) => {
    const { proposalId, support } = req.body;
    
    // 验证必填字段
    if (proposalId === undefined || support === undefined) {
      return res.status(400).json({ 
        error: "proposalId 和 support 均为必填" 
      });
    }
    
    // 验证 support 值（0=反对，1=赞成，2=弃权）
    if (![0, 1, 2].includes(Number(support))) {
      return res.status(400).json({ 
        error: "support 须为 0（反对）、1（赞成）、2（弃权）" 
      });
    }
    
    try {
      const updated = castVote({
        proposalId: Number(proposalId),
        voter: req.auth?.address ?? "0x0000",
        support: Number(support),
      });
      
      res.json({ success: true, ...updated });
    } catch (err) {
      // 错误码映射
      const MAP = {
        ALREADY_VOTED: [409, "您已对该提案投过票"],
        NOT_FOUND: [404, "提案不存在"],
        VOTE_ENDED: [410, "投票期已结束"],
      };
      const [status, msg] = MAP[err.code] ?? [500, err.message];
      res.status(status).json({ error: msg });
    }
  }
);

export default router;
