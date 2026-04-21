/**
 * reputationRoutes.js
 * 声誉系统与历史行为锚定路由
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
    validateReputationSignals,
    recordReputationVerification,
    getReputationHistory,
    anchorHistoryBehavior,
    getHistoryBehaviorProof,
    getCurrentHistoryRoot,
    validateHistoryAnchorSignals,
    getUserBehaviorHistory,
} from "../services/reputation.service.js";
import { preVerifyProofPayload } from "../services/zkVerify.service.js";
import { verifyGroth16Full } from "../services/circuitVerify.service.js";
import { createHash } from "node:crypto";

const router = Router();

// POST /v1/reputation/verify — 验证声誉分 ZK 证明
router.post(
    "/verify",
    requireAuth,
    rateLimit({ max: 10, windowMs: 60_000 }),
    async (req, res) => {
        const { proof, pubSignals, score } = req.body || {};
        if (!proof || !pubSignals) {
            return res.status(400).json({ code: 4080, error: "proof and pubSignals required" });
        }

        // public signals 格式验证
        const check = await validateReputationSignals(pubSignals, score);
        if (!check.ok) return res.status(400).json({ code: check.code, error: check.error });

        // ZK 证明格式预验证
        const zk = preVerifyProofPayload({ proof, publicSignals: pubSignals });
        if (!zk.ok) return res.status(400).json({ code: zk.code, error: zk.error });

        const full = await verifyGroth16Full("reputation_verifier", proof, pubSignals);
        if (!full.ok) {
            return res.status(400).json({ code: 4084, error: full.error || "ZK verify failed" });
        }

        // 计算证明摘要（审计用，不含私有数据）
        const proofHash = createHash("sha256")
            .update(JSON.stringify({ pubSignals }))
            .digest("hex");

        const address = String(req.auth?.address || "").toLowerCase() || "anonymous";
        const record = await recordReputationVerification(
            address,
            check.reputationHash,
            check.requiredScore,
            proofHash
        );

        return res.status(202).json({
            success: true,
            requiredScore: check.requiredScore,
            reputationHash: check.reputationHash,
            verifiedAt: record.verifiedAt,
        });
    }
);

// GET /v1/reputation/:address — 查询声誉验证历史
router.get("/:address", requireAuth, (req, res) => {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return res.status(400).json({ code: 4081, error: "invalid address format" });
    }
    const history = getReputationHistory(address);
    return res.json({ address: address.toLowerCase(), history });
});

// POST /v1/reputation/history/anchor — 锚定历史行为到 Merkle 树
router.post(
    "/history/anchor",
    requireAuth,
    requireRole("oracle"),
    rateLimit({ max: 30, windowMs: 60_000 }),
    async (req, res) => {
        const { address, historyData, behaviorLevel } = req.body || {};
        if (!address || !historyData || behaviorLevel === undefined) {
            return res.status(400).json({ code: 4082, error: "address/historyData/behaviorLevel required" });
        }
        if (behaviorLevel < 0 || behaviorLevel > 100) {
            return res.status(400).json({ code: 4083, error: "behaviorLevel must be 0-100" });
        }
        try {
            const result = await anchorHistoryBehavior(address, historyData, Number(behaviorLevel));
            return res.status(201).json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ code: 5030, error: err.message });
        }
    }
);

// GET /v1/reputation/history/root — 获取历史行为 Merkle 根
router.get("/history/root", async (_req, res) => {
    const root = await getCurrentHistoryRoot();
    return res.json({ merkleRoot: root });
});

// POST /v1/reputation/history/proof — 获取历史行为 Merkle 证明
router.post(
    "/history/proof",
    requireAuth,
    async (req, res) => {
        const { historyData } = req.body || {};
        if (!historyData) {
            return res.status(400).json({ code: 4084, error: "historyData required" });
        }
        const proof = await getHistoryBehaviorProof(historyData);
        if (!proof) {
            return res.status(404).json({ code: 4085, error: "history data not found in tree" });
        }
        return res.json({ success: true, ...proof });
    }
);

// POST /v1/reputation/history/verify-anchor — 校验 history_anchor.circom + 与当前历史树根对齐
router.post(
    "/history/verify-anchor",
    requireAuth,
    rateLimit({ max: 25, windowMs: 60_000 }),
    async (req, res) => {
        const body = req.body || {};
        const pub = body.pubSignals || body.publicSignals;
        const zk = preVerifyProofPayload({ proof: body.proof, publicSignals: pub });
        if (!zk.ok) {
            return res.status(400).json({ code: 4086, error: zk.error });
        }
        const chk = await validateHistoryAnchorSignals(pub);
        if (!chk.ok) {
            return res.status(400).json({ code: chk.code, error: chk.error });
        }
        const full = await verifyGroth16Full("history_anchor", body.proof, pub);
        if (!full.ok && !full.skipped) {
            return res.status(400).json({
                code: 4087,
                error: full.error || "history_anchor verify failed",
                detail: full.code,
            });
        }
        return res.json({
            success: true,
            merkleRoot: chk.merkleRoot,
            historyHash: chk.historyHash,
            skipped: Boolean(full.skipped),
        });
    }
);

// GET /v1/reputation/:address/behaviors — 获取用户行为历史列表（脱敏）
router.get("/:address/behaviors", requireAuth, (req, res) => {
    const { address } = req.params;
    const behaviors = getUserBehaviorHistory(address);
    return res.json({ address: address.toLowerCase(), behaviors });
});

export default router;
