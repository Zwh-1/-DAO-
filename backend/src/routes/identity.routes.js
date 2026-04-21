/**
 * identityRoutes.js
 * 身份注册与 SBT 路由
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
    registerIdentityCommitment,
    registerFromWitness,
    updateCommitmentLevel,
    banIdentityCommitment,
    setCommitmentExpiry,
    getCommitmentStatus,
    mintSBT,
    getSBTInfo,
    updateSBTCredit,
} from "../services/identity.service.js";
import { getWhitelistRoot, getWhitelistProof, addLeafToWhitelist } from "../services/merkleTree.service.js";
import { verifyGroth16Full } from "../services/circuitVerify.service.js";
import { preVerifyProofPayload } from "../services/zkVerify.service.js";

const router = Router();

// POST /v1/identity/register
// 注册身份承诺（已计算好的 commitment）
router.post(
    "/register",
    requireAuth,
    requireRole("oracle"),
    rateLimit({ max: 50, windowMs: 60_000 }),
    async (req, res) => {
        const { commitment, level } = req.body || {};
        if (!commitment || level === undefined) {
            return res.status(400).json({ code: 4001, error: "commitment and level are required" });
        }
        if (level < 1 || level > 5) {
            return res.status(400).json({ code: 4002, error: "level must be between 1 and 5" });
        }
        try {
            const result = await registerIdentityCommitment(String(commitment), Number(level));
            return res.status(201).json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5001, error: err.message });
        }
    }
);

// POST /v1/identity/register-witness
// 从私有见证人注册（仅后端内部使用；生产禁止前端直传 secret）
router.post(
    "/register-witness",
    requireAuth,
    requireRole("oracle"),
    rateLimit({ max: 20, windowMs: 60_000 }),
    async (req, res) => {
        const { socialIdHash, secret, trapdoor, level } = req.body || {};
        if (!socialIdHash || !secret || !trapdoor || level === undefined) {
            return res.status(400).json({ code: 4003, error: "socialIdHash/secret/trapdoor/level are required" });
        }
        try {
            const result = await registerFromWitness(socialIdHash, secret, trapdoor, Number(level));
            // 从响应中移除 commitment（让用户自己保存）
            return res.status(201).json({ success: true, merkleRoot: result.merkleRoot, merkleLeaf: result.merkleLeaf, mode: result.mode });
        } catch (err) {
            return res.status(500).json({ code: 5002, error: err.message });
        }
    }
);

// GET /v1/identity/commitment/:hash
// 查询承诺状态
router.get("/commitment/:hash", async (req, res) => {
    try {
        const status = await getCommitmentStatus(req.params.hash);
        return res.json(status);
    } catch (err) {
        return res.status(400).json({ code: 4004, error: err.message });
    }
});

// POST /v1/identity/commitment/update-level
// 更新承诺等级
router.post(
    "/commitment/update-level",
    requireAuth,
    requireRole("oracle"),
    async (req, res) => {
        const { commitment, newLevel } = req.body || {};
        if (!commitment || newLevel === undefined) {
            return res.status(400).json({ code: 4005, error: "commitment and newLevel are required" });
        }
        try {
            const result = await updateCommitmentLevel(String(commitment), Number(newLevel));
            return res.json({ success: true, ...result });
        } catch (err) {
            if (err.code === "NOT_REGISTERED") return res.status(404).json({ code: 4041, error: err.message });
            return res.status(500).json({ code: 5003, error: err.message });
        }
    }
);

// POST /v1/identity/commitment/ban
// 封禁承诺（挑战失败时调用）
router.post(
    "/commitment/ban",
    requireAuth,
    requireRole("oracle"),
    async (req, res) => {
        const { commitment, reason } = req.body || {};
        if (!commitment || !reason?.trim()) {
            return res.status(400).json({ code: 4006, error: "commitment and reason are required" });
        }
        try {
            const result = await banIdentityCommitment(String(commitment), reason.trim());
            return res.json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5004, error: err.message });
        }
    }
);

// POST /v1/identity/commitment/expiry
// 设置承诺过期时间
router.post(
    "/commitment/expiry",
    requireAuth,
    requireRole("oracle"),
    async (req, res) => {
        const { commitment, expiryTime } = req.body || {};
        if (!commitment || expiryTime === undefined) {
            return res.status(400).json({ code: 4007, error: "commitment and expiryTime are required" });
        }
        try {
            const result = await setCommitmentExpiry(String(commitment), Number(expiryTime));
            return res.json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5005, error: err.message });
        }
    }
);

// POST /v1/identity/sbt/mint
// 铸造 SBT
router.post(
    "/sbt/mint",
    requireAuth,
    requireRole("oracle"),
    rateLimit({ max: 20, windowMs: 60_000 }),
    async (req, res) => {
        const { address, commitment } = req.body || {};
        if (!address || !commitment) {
            return res.status(400).json({ code: 4008, error: "address and commitment are required" });
        }
        if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
            return res.status(400).json({ code: 4009, error: "invalid address format" });
        }
        try {
            const result = await mintSBT(address, String(commitment));
            return res.status(201).json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5006, error: err.message });
        }
    }
);

// GET /v1/identity/sbt/:address
// 查询 SBT 信息
router.get("/sbt/:address", async (req, res) => {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ code: 4010, error: "invalid address format" });
    }
    try {
        const info = await getSBTInfo(address);
        return res.json(info);
    } catch (err) {
        return res.status(500).json({ code: 5007, error: err.message });
    }
});

// POST /v1/identity/sbt/update-credit
// 更新信用分
router.post(
    "/sbt/update-credit",
    requireAuth,
    requireRole("oracle"),
    async (req, res) => {
        const { tokenId, creditScore } = req.body || {};
        if (tokenId === undefined || creditScore === undefined) {
            return res.status(400).json({ code: 4011, error: "tokenId and creditScore are required" });
        }
        try {
            const result = await updateSBTCredit(String(tokenId), Number(creditScore));
            return res.json({ success: true, ...result });
        } catch (err) {
            if (err.code === "INVALID_CREDIT_SCORE") return res.status(400).json({ code: 4012, error: err.message });
            return res.status(500).json({ code: 5008, error: err.message });
        }
    }
);

// POST /v1/identity/whitelist/proof
// 获取用户身份承诺的白名单 Merkle 路径（供前端 anti_sybil_verifier 电路使用）
router.post(
    "/whitelist/proof",
    requireAuth,
    rateLimit({ max: 20, windowMs: 60_000 }),
    async (req, res) => {
        const { identityCommitment, userLevel = 1 } = req.body || {};
        if (!identityCommitment) {
            return res.status(400).json({ code: 4060, error: "identityCommitment is required" });
        }
        try {
            const proof = await getWhitelistProof(String(identityCommitment), Number(userLevel));
            if (!proof) {
                return res.status(404).json({
                    code: 4061,
                    error: "identityCommitment not found in whitelist, please register identity first",
                });
            }
            return res.json({
                leafIndex: proof.leafIndex,
                merkleRoot: proof.root,
                pathElements: proof.pathElements,
                pathIndices: proof.pathIndices,
                leaf: proof.leaf,
            });
        } catch (err) {
            return res.status(500).json({ code: 5010, error: err.message });
        }
    }
);

// POST /v1/identity/whitelist/register
// 已认证用户自注册身份承诺到白名单（member 提交理赔前调用）
router.post(
    "/whitelist/register",
    requireAuth,
    rateLimit({ max: 5, windowMs: 60_000 }),
    async (req, res) => {
        const { identityCommitment, userLevel = 1 } = req.body || {};
        if (!identityCommitment) {
            return res.status(400).json({ code: 4062, error: "identityCommitment is required" });
        }
        if (Number(userLevel) < 1 || Number(userLevel) > 5) {
            return res.status(400).json({ code: 4063, error: "userLevel must be between 1 and 5" });
        }
        try {
            const result = await addLeafToWhitelist(String(identityCommitment), Number(userLevel));
            return res.status(201).json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5011, error: err.message });
        }
    }
);

// GET /v1/identity/whitelist/root
// 获取当前白名单 Merkle 根
router.get("/whitelist/root", async (_req, res) => {
    const root = await getWhitelistRoot();
    return res.json({ merkleRoot: root });
});

// POST /v1/identity/verify-commitment-zk
// 校验 identity_commitment.circom 的 Groth16 证明（2 个 public：social_id_hash, identity_commitment）
router.post(
    "/verify-commitment-zk",
    rateLimit({ max: 40, windowMs: 60_000 }),
    async (req, res) => {
        const body = req.body || {};
        const pub = body.pubSignals || body.publicSignals;
        const zk = preVerifyProofPayload({ proof: body.proof, publicSignals: pub });
        if (!zk.ok) {
            return res.status(400).json({ code: 4013, error: zk.error });
        }
        if (!Array.isArray(pub) || pub.length !== 2) {
            return res.status(400).json({
                code: 4014,
                error: "pubSignals/publicSignals must have exactly 2 elements for identity_commitment",
            });
        }
        try {
            const full = await verifyGroth16Full("identity_commitment", body.proof, pub);
            if (!full.ok && !full.skipped) {
                return res.status(400).json({
                    code: 4015,
                    error: full.error || "ZK verify failed",
                    detail: full.code,
                });
            }
            return res.json({ success: true, skipped: Boolean(full.skipped) });
        } catch (err) {
            return res.status(500).json({ code: 5010, error: err.message });
        }
    }
);

export default router;
