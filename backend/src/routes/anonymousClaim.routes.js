/**
 * anonymousClaimRoutes.js
 * 匿名资金申领路由
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { requireAdmin } from "../middleware/auth.js";
import { config } from "../config.js";
import {
    validateAnonymousClaimSignals,
    isNullifierUsed,
    submitAnonymousClaim,
    getAnonymousClaimStatus,
    fundAnonymousClaimContract,
    isAnonymousClaimRelayEnabled,
} from "../services/anonymousClaim.service.js";
import { preVerifyAnonymousClaimPayload } from "../services/zkVerify.service.js";
import { verifyGroth16Full } from "../services/circuitVerify.service.js";
import {
    addAnonymousClaimLeaf,
    getAnonymousClaimMerkleProof,
    getAnonymousClaimMerkleRoot,
} from "../services/merkleTree.service.js";

const router = Router();

// GET /v1/anonymous-claim/status
// 查询匿名申领合约状态
router.get("/status", async (_req, res) => {
    const status = await getAnonymousClaimStatus();
    let offchainRoot = null;
    try {
        offchainRoot = await getAnonymousClaimMerkleRoot();
    } catch {
        offchainRoot = null;
    }
    return res.json({ ...status, offchainMerkleRoot: offchainRoot });
});

// GET /v1/anonymous-claim/merkle-root
// 当前链下匿名申领 Merkle 根（用于与合约部署根对齐）
router.get("/merkle-root", async (_req, res) => {
    try {
        const merkleRoot = await getAnonymousClaimMerkleRoot();
        return res.json({ merkleRoot });
    } catch (err) {
        return res.status(500).json({ code: 5013, error: err.message });
    }
});

// POST /v1/anonymous-claim/merkle-proof
// 根据 commitment 返回 leafIndex + merkle_path（20）
router.post(
    "/merkle-proof",
    rateLimit({ max: 30, windowMs: 60_000 }),
    async (req, res) => {
        const { commitment } = req.body || {};
        if (commitment === undefined || commitment === null || commitment === "") {
            return res.status(400).json({ code: 4054, error: "commitment is required" });
        }
        try {
            const proof = await getAnonymousClaimMerkleProof(commitment);
            if (!proof) {
                return res.status(404).json({ code: 4055, error: "commitment not registered in merkle tree" });
            }
            return res.json({
                leafIndex: proof.leafIndex,
                merkleRoot: proof.root,
                pathElements: proof.pathElements,
                pathIndices: proof.pathIndices,
                leaf: proof.leaf,
            });
        } catch (err) {
            return res.status(500).json({ code: 5014, error: err.message });
        }
    }
);

// POST /v1/anonymous-claim/register-commitment
// 注册 commitment 叶子（限流；生产环境应配合鉴权或管理员流程）
router.post(
    "/register-commitment",
    rateLimit({ max: 20, windowMs: 60_000 }),
    async (req, res) => {
        const { commitment } = req.body || {};
        if (commitment === undefined || commitment === null || commitment === "") {
            return res.status(400).json({ code: 4054, error: "commitment is required" });
        }
        try {
            const result = await addAnonymousClaimLeaf(commitment);
            return res.status(201).json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5015, error: err.message });
        }
    }
);

// GET /v1/anonymous-claim/nullifier/:hash
// 检查 nullifier 是否已使用
router.get("/nullifier/:hash", async (req, res) => {
    try {
        const used = await isNullifierUsed(req.params.hash);
        return res.json({ nullifier: req.params.hash, used });
    } catch {
        return res.status(400).json({ code: 4050, error: "invalid nullifier format" });
    }
});

// POST /v1/anonymous-claim/claim
// 提交匿名申领（ZK 证明 + 链上转账）
router.post(
    "/claim",
    rateLimit({ max: 5, windowMs: 60_000 }),
    async (req, res) => {
        const { recipient, amount, nullifier, proof, pubSignals } = req.body || {};
        if (!recipient || !amount || !nullifier || !proof || !pubSignals) {
            return res.status(400).json({
                code: 4051,
                error: "recipient/amount/nullifier/proof/pubSignals are required",
            });
        }
        if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
            return res.status(400).json({ code: 4052, error: "invalid recipient address" });
        }

        if (config.nodeEnv === "production" && !isAnonymousClaimRelayEnabled()) {
            return res.status(503).json({
                code: 5031,
                error: "匿名申领链上中继未配置：生产环境禁止纯链下申领成功语义",
            });
        }

        // 验证 public signals 格式（7 个信号）
        const signalCheck = validateAnonymousClaimSignals(pubSignals, amount, nullifier);
        if (!signalCheck.ok) {
            return res.status(400).json({ code: signalCheck.code, error: signalCheck.error });
        }

        // ZK 证明格式预验证（7 个 pubSignals + Groth16 结构）
        const zk = preVerifyAnonymousClaimPayload({ proof, pubSignals });
        if (!zk.ok) {
            return res.status(400).json({ code: zk.code, error: zk.error });
        }

        const full = await verifyGroth16Full("anonymous_claim", proof, pubSignals);
        if (!full.ok) {
            return res.status(400).json({ code: 4013, error: full.error || "ZK verify failed" });
        }

        try {
            const result = await submitAnonymousClaim(recipient, amount, nullifier, proof, pubSignals);
            return res.status(202).json({ success: true, ...result });
        } catch (err) {
            if (err.code === "DUPLICATE_NULLIFIER") {
                return res.status(409).json({ code: 2002, error: "Nullifier already used" });
            }
            if (err.code === "RELAY_DISABLED") {
                // 离线模式：返回成功（用户自行提交链上）
                return res.status(202).json({ success: true, mode: "offchain", nullifier, amount });
            }
            return res.status(500).json({ code: 5010, error: err.message });
        }
    }
);

// POST /v1/anonymous-claim/fund  (管理员)
// 向匿名申领合约存入 ETH
router.post(
    "/fund",
    requireAdmin,
    async (req, res) => {
        const { amountWei } = req.body || {};
        if (!amountWei) {
            return res.status(400).json({ code: 4053, error: "amountWei is required" });
        }
        try {
            const result = await fundAnonymousClaimContract(amountWei);
            return res.json({ success: true, ...result });
        } catch (err) {
            if (err.code === "RELAY_DISABLED") {
                return res.status(503).json({ code: 5011, error: "on-chain relay not configured" });
            }
            return res.status(500).json({ code: 5012, error: err.message });
        }
    }
);

export default router;
