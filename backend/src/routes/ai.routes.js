/**
 * ai.routes.js
 * AI 智能服务相关路由
 * 
 * 职责：
 *   - AI 智能客服聊天
 *   - AI 安全审计
 * 
 * 安全说明：
 *   - 聊天接口需限流防止滥用
 *   - 审计接口需 Admin 权限
 */

import { Router } from "express";
import { requireAuth, requireAdmin, tryAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { asyncHandler } from "../utils/errors.js";
import { chatWithAI } from "../services/aiChat.service.js";
import {
  auditClaimProposal,
  auditSecurityArchitecture,
} from "../services/aiAudit.service.js";

const router = Router();

/**
 * POST /v1/ai/chat
 * AI 智能客服聊天
 * 
 * 限流：20 次/分钟
 * 
 * 请求体：
 *   - message: 用户消息（不能为空，最多 500 字）
 * 
 * 响应：
 *   - reply: AI 回复内容
 * 
 * 错误处理：
 *   - 消息为空或超过 500 字时返回错误
 *   - AI 服务不可用时返回友好提示
 */
router.post(
  "/chat",
  tryAuth,
  rateLimit({ max: 20, windowMs: 60_000 }),
  async (req, res) => {
    const { message } = req.body;
    
    // 验证消息不能为空
    if (!message?.trim()) {
      return res.status(400).json({ error: "message 不能为空" });
    }
    
    // 验证消息长度
    if (message.length > 500) {
      return res.status(400).json({ error: "message 不超过 500 字" });
    }
    
    const role = req.auth?.activeRole ?? "member";

    try {
      const reply = await chatWithAI(message.trim(), role);
      res.json({ reply });
    } catch (err) {
      // AI 服务不可用时返回友好提示
      res.status(500).json({ 
        reply: "AI 服务暂时不可用，请稍后再试。" 
      });
    }
  }
);

/**
 * POST /v1/ai/security-audit
 * AI 安全审计报告
 * 
 * 权限要求：Admin
 * 
 * 响应：
 *   - title: 审计主题
 *   - results: 审计结果列表
 *     - level: 风险等级（high/medium/low）
 *     - item: 审计项目
 *     - recommendation: 建议
 */
router.get("/security-audit", requireAdmin, asyncHandler(async (req, res) => {
  const report = await auditSecurityArchitecture();
  return res.json(report);
}));

/**
 * POST /v1/claim/audit
 * AI 审计申领提案
 * 
 * 注意：此路由也用于 claim 相关功能
 * 为了保持模块清晰，保留在 ai.routes 中
 * 
 * 权限要求：已认证用户
 * 限流：20 次/分钟
 */
router.post(
  "/claim-audit",
  requireAuth,
  rateLimit({ max: 20, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    const report = await auditClaimProposal(req.body || {});
    return res.json(report);
  })
);

export default router;
