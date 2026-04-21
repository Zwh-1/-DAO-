/**
 * claim.routes.js
 * 申领相关路由
 * 
 * 职责：
 *   - 申领提案提交
 *   - 申领状态查询
 *   - Nullifier 审计
 * 
 * 安全说明：
 *   - 验证 ZK 证明有效性
 *   - 检查 Nullifier 防重放
 *   - 日志脱敏（不记录隐私数据）
 */

import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { preVerifyProofPayload } from "../services/zkVerify.service.js";
import { config, isOnchainRelayEnabled } from "../config.js";
import { parseGroth16ProofForVault, submitClaimOnchain } from "../onchain.js";
import {
  insertNullifierDb,
  countNullifiers,
  getPool,
  insertClaimDb
} from "../db/pool.js";
import {
  saveClaim,
  getClaimById,
  listClaimsByAddress,
  updateClaimStatus,
  insertNullifierOrThrow,
  getUsedNullifierCount
} from "../storage.js";
import { maskAddress } from "../security.js";
import { asyncHandler } from "../utils/errors.js";
import { verifyGroth16Full } from "../services/circuitVerify.service.js";

const router = Router();

/**
 * 验证申领请求体完整性
 */
function validateClaimPayload(body) {
  const required = ["claimId", "nullifierHash", "proof", "publicSignals", "evidenceCid", "amount", "policyId"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      return `Missing required field: ${key}`;
    }
  }
  if (!Array.isArray(body.publicSignals)) {
    return "publicSignals must be an array";
  }
  return null;
}

/**
 * 统一的 Nullifier 插入（支持数据库和内存）
 */
async function insertNullifierUnified(nullifierHash) {
  const p = getPool();
  if (p) {
    await insertNullifierDb(nullifierHash);
    return;
  }
  insertNullifierOrThrow(nullifierHash);
}

/**
 * POST /v1/claim/propose
 * 提交申领提案
 * 
 * 权限要求：已认证用户
 * 限流：10 次/分钟
 * 
 * 请求体：
 *   - claimId: 申领 ID
 *   - nullifierHash: Nullifier 哈希
 *   - proof: ZK 证明
 *   - publicSignals: 公开信号数组（8 个元素）
 *   - evidenceCid: IPFS 证据 CID
 *   - address: 申领地址
 *   - amount: 申领金额
 * 
 * 响应：
 *   - code: 响应码（0 表示成功）
 *   - status: 申领状态
 *   - claimId: 申领 ID
 *   - nullifierHash: Nullifier 哈希
 *   - onchain: 链上中继信息
 */
router.post(
  "/propose",
  requireAuth,
  rateLimit({ max: 10, windowMs: 60_000 }),
  async (req, res) => {
    // 验证请求体完整性
    const error = validateClaimPayload(req.body);
    if (error) {
      return res.status(400).json({ code: 4001, error });
    }

    if (config.nodeEnv === "production" && req.body?.proof?._isMock === true) {
      return res.status(400).json({
        code: 2010,
        error: "生产环境禁止使用 Mock 证明",
      });
    }

    // 预验证 ZK 证明
    const zk = preVerifyProofPayload(req.body);
    if (!zk.ok) {
      return res.status(400).json({ code: zk.code, error: zk.error });
    }

    // 非 Mock 且为 anti_sybil_verifier（8 public）时，链下全量 Groth16 校验
    if (
      req.body.proof &&
      !req.body.proof._isMock &&
      Array.isArray(req.body.publicSignals) &&
      req.body.publicSignals.length === 8
    ) {
      const full = await verifyGroth16Full(
        "anti_sybil_verifier",
        req.body.proof,
        req.body.publicSignals
      );
      if (!full.ok && !full.skipped) {
        return res.status(400).json({
          code: 2011,
          error: full.error || "anti_sybil_verifier groth16 verify failed",
          detail: full.code,
        });
      }
    }

    // 如果启用了链上中继，需要额外验证
    if (isOnchainRelayEnabled()) {
      // 禁止使用 Mock 证明
      if (req.body.proof && req.body.proof._isMock === true) {
        return res.status(400).json({
          code: 2009,
          error: "链上中继已启用：请使用真实 snarkjs 证明（非 Mock）"
        });
      }
      
      // 验证 Groth16 证明格式
      try {
        parseGroth16ProofForVault(req.body.proof);
      } catch (e) {
        return res.status(400).json({
          code: 2001,
          error: e.code === "INVALID_PROOF_SHAPE" 
            ? String(e.message) 
            : "Invalid Groth16 proof for relay"
        });
      }
      
      // 验证 publicSignals 数量（anti_sybil_verifier 需要 8 个）
      const sigs = req.body.publicSignals;
      if (!Array.isArray(sigs) || sigs.length !== 8) {
        return res.status(400).json({
          code: 4006,
          error: "publicSignals must have exactly 8 elements (anti_sybil_verifier) when on-chain relay is enabled"
        });
      }
      
      // 验证金额与 publicSignals[4] 一致
      const amountFromProof = String(BigInt(String(sigs[4]))); // [4] claim_amount
      if (amountFromProof !== String(req.body.amount ?? "").trim()) {
        return res.status(400).json({ 
          code: 4007, 
          error: "amount must match publicSignals[4] (claim_amount)" 
        });
      }
      
      // 验证 nullifierHash 与 publicSignals[2] 一致
      const nh = String(req.body.nullifierHash ?? "").toLowerCase();
      const fromProof = "0x" + BigInt(String(sigs[2])) // [2] nullifier_hash
        .toString(16)
        .padStart(64, "0");
      if (fromProof.toLowerCase() !== nh) {
        return res.status(400).json({ 
          code: 4008, 
          error: "nullifierHash must match publicSignals[2]" 
        });
      }

      const sig = String(req.body.claimSignature ?? "").trim();
      if (!sig.startsWith("0x") || sig.length !== 132) {
        return res.status(400).json({
          code: 4009,
          error: "claimSignature required when on-chain relay is enabled (0x + 65 bytes EIP-712 Claim signature from claimant)"
        });
      }
    }

    // 提取请求参数
    const { claimId, nullifierHash, evidenceCid, address, amount, policyId } = req.body;
    const authed = String(req.auth?.address || "").toLowerCase();
    
    // 验证地址一致性
    if (authed && String(address || "").toLowerCase() !== authed) {
      return res.status(403).json({ 
        code: 9003, 
        error: "地址与登录钱包不一致" 
      });
    }

    // 插入 Nullifier（防重放）
    try {
      await insertNullifierUnified(nullifierHash);
    } catch (err) {
      if (err.code === "DUPLICATE_NULLIFIER") {
        return res.status(409).json({
          code: 2002,
          error: "Nullifier already used (anti-replay triggered)"
        });
      }
      return res.status(500).json({ 
        code: 5002, 
        error: "Nullifier registry unavailable" 
      });
    }

    // 保存申领记录
    const claim = saveClaim({
      claimId,
      nullifierHash,
      proof: req.body.proof,
      publicSignals: req.body.publicSignals,
      evidenceCid,
      address: String(address || "").toLowerCase(),
      amount: String(amount)
    });
    
    // 尝试保存到数据库（如果可用）
    try {
      await insertClaimDb({
        claimId,
        nullifierHash,
        evidenceCid,
        address: claim.address,
        amount: claim.amount,
        status: claim.status,
        createdAt: claim.createdAt
      });
    } catch {
      // 数据库未迁移或无连接时忽略（仍以内存为准）
    }

    // 尝试链上提交
    let onchain = { mode: "disabled" };
    try {
      onchain = await submitClaimOnchain({
        proof: req.body.proof,
        publicSignals: req.body.publicSignals,
        signature: req.body.claimSignature
      });
    } catch (err) {
      return res.status(409).json({
        code: 2003,
        error: "On-chain relay failed",
        detail: String(err.message || err)
      });
    }

    // 日志脱敏：不记录完整地址和隐私数据
    console.log(
      `[claim] accepted claimId=${claimId} nullifier=${nullifierHash.slice(0, 12)}... address=${maskAddress(address)} cid=${evidenceCid}`
    );

    return res.status(202).json({
      code: 0,
      status: claim.status,
      claimId,
      nullifierHash,
      onchain
    });
  }
);

/**
 * GET /v1/claim/status/:id
 * 查询申领状态
 * 
 * 路径参数：
 *   - id: 申领 ID
 * 
 * 响应：
 *   - claimId: 申领 ID
 *   - status: 状态
 *   - amount: 金额
 *   - createdAt: 创建时间
 */
router.get(
  "/status/:id",
  (req, res) => {
    const claim = getClaimById(req.params.id);
    if (!claim) {
      return res.status(404).json({ code: 4041, error: "Claim not found" });
    }
    return res.json(claim);
  }
);

/**
 * GET /v1/claim/list
 * 按地址查询申领记录（分页）
 * 
 * 查询参数：
 *   - address: 申领人地址（必填）
 *   - page: 页码（默认 1）
 *   - limit: 每页条数（默认 20，最大 100）
 * 
 * 响应：
 *   - claims: 申领列表
 *   - total / page / limit / totalPages
 */
router.get(
  "/list",
  requireAuth,
  (req, res) => {
    const address = String(req.query.address || req.auth?.address || "").trim();
    if (!address) {
      return res.status(400).json({ code: 4001, error: "address 查询参数必填" });
    }
    const result = listClaimsByAddress(address, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    return res.json(result);
  }
);

/**
 * PATCH /v1/claim/status/:id
 * 更新申领状态（Admin / Guardian 操作）
 * 
 * 路径参数：
 *   - id: 申领 ID
 * 
 * 请求体：
 *   - status: 新状态 (APPROVED / REJECTED / PENDING_REVIEW)
 * 
 * 响应：
 *   - claim: 更新后的申领记录
 */
router.patch(
  "/status/:id",
  requireAdmin,
  (req, res) => {
    const VALID_STATUSES = ["APPROVED", "REJECTED", "PENDING_REVIEW", "UNDER_INVESTIGATION"];
    const newStatus = String(req.body?.status || "").trim();
    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        code: 4001,
        error: `status 须为 ${VALID_STATUSES.join(" / ")}`,
      });
    }
    const claim = updateClaimStatus(req.params.id, newStatus);
    if (!claim) {
      return res.status(404).json({ code: 4041, error: "Claim not found" });
    }
    return res.json({ claim });
  }
);

/**
 * GET /v1/audit/nullifier
 * 审计 Nullifier 使用情况
 * 
 * 响应：
 *   - riskLevel: 风险等级
 *   - usedNullifierCount: 已使用的 Nullifier 数量
 *   - suggestion: 建议
 */
router.get(
  "/nullifier",
  asyncHandler(async (req, res) => {
    const p = getPool();
    const used = p ? await countNullifiers() : getUsedNullifierCount();
    
    res.json({
      riskLevel: "low",
      usedNullifierCount: used,
      suggestion: "Persist used nullifiers and protect insert with unique index."
    });
  })
);

export default router;
