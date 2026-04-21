/**
 * security.routes.js
 * 安全相关路由
 * 
 * 职责：
 *   - 安全基线查询
 *   - Nullifier 派生
 *   - 风险评估
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { deriveNullifier, getSecurityBaseline } from "../security.js";
import { recommendStakingRatio } from "../services/riskEngine.service.js";
import { config } from "../config.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();

function assertServerNullifierDeriveAllowed(req, res, next) {
  if (config.nodeEnv === "production" && !config.allowServerNullifierDerive) {
    return res.status(403).json({
      code: 4033,
      error: "服务端 Nullifier 派生已禁用；请在客户端本地使用 Poseidon 派生",
      hint: "开发自测可设置 ALLOW_SERVER_NULLIFIER_DERIVE=1（不推荐生产）",
    });
  }
  next();
}

/**
 * GET /v1/security/baseline
 * 查询安全基线配置
 * 
 * 响应：
 *   - baseline: 安全基线配置
 *     - maxNullifierCollisions: 最大碰撞次数
 *     - timeWindowMs: 时间窗口
 *     - riskThresholds: 风险阈值
 */
router.get(
  "/baseline",
  (_, res) => {
    res.json(getSecurityBaseline());
  }
);

/**
 * POST /v1/nullifier/derive
 * 派生 Nullifier（用于防重放检查）
 * 
 * 权限要求：已认证用户
 * 
 * 请求体：
 *   - secret: 私有密钥
 *   - airdropId: 空投 ID
 * 
 * 响应：
 *   - nullifierHash: 派生的 Nullifier 哈希
 * 
 * 安全说明：
 *   - secret 为敏感信息，传输时需加密
 *   - 后端不存储 secret，仅用于计算
 */
router.post(
  "/nullifier/derive",
  requireAuth,
  assertServerNullifierDeriveAllowed,
  (req, res) => {
    const { secret, airdropId } = req.body || {};
    
    // 验证必填字段
    if (!secret || !airdropId) {
      return res.status(400).json({ 
        code: 4002, 
        error: "secret and airdropId are required" 
      });
    }
    
    const nullifierHash = deriveNullifier(secret, airdropId);
    return res.json({ nullifierHash });
  }
);

/**
 * GET /v1/risk/recommend
 * 获取风险建议（推荐质押比例）
 * 
 * 响应：
 *   - recommendedStakingRatio: 推荐质押比例
 *   - riskLevel: 风险等级
 *   - factors: 影响因素
 */
router.get(
  "/recommend",
  asyncHandler(async (req, res) => {
    const address = String(req.query.address || "").trim();
    const result = await recommendStakingRatio({
      recentNullifierCollisions: Number(req.query.collisions) || 0,
      address,
    });
    res.json(result);
  })
);

export default router;
