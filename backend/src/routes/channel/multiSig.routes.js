/**
 * multiSigRoutes.js
 * 多签提案 ZK 验证 + Governance 时间锁路由
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import {
    validateMultiSigSignals,
    recordMultiSigVerification,
    getMultiSigVerifications,
    queueProposal,
    executeProposal,
    cancelProposal,
    getOnchainProposalState,
} from "../../services/channel/multiSig.service.js";
import { preVerifyProofPayload } from "../../services/identity/zkVerify.service.js";
import { verifyGroth16Full } from "../../services/identity/circuitVerify.service.js";

const router = Router();

// POST /v1/multisig/verify — 验证多签 ZK 证明
router.post(
    "/verify",
    requireAuth,
    rateLimit({ max: 10, windowMs: 60_000 }),
    async (req, res) => {
        const { proof, pubSignals } = req.body || {};
        if (!proof || !pubSignals) {
            return res.status(400).json({ code: 4090, error: "proof and pubSignals required" });
        }

        const check = validateMultiSigSignals(pubSignals);
        if (!check.ok) return res.status(400).json({ code: check.code, error: check.error });

        const zk = preVerifyProofPayload({ proof, publicSignals: pubSignals });
        if (!zk.ok) return res.status(400).json({ code: zk.code, error: zk.error });

        const full = await verifyGroth16Full("multi_sig_proposal", proof, pubSignals);
        if (!full.ok) {
            return res.status(400).json({ code: 4091, error: full.error || "ZK verify failed" });
        }

        try {
            const record = await recordMultiSigVerification(check.proposalId, check.authHash, check.threshold);
            return res.status(202).json({ success: true, ...record });
        } catch (e) {
            return res.status(500).json({ code: 5045, error: e.message });
        }
    }
);

// GET /v1/multisig/verifications/:proposalId — 查询多签验证记录
router.get("/verifications/:proposalId", requireAuth, async (req, res) => {
    const records = await getMultiSigVerifications(req.params.proposalId);
    return res.json({ proposalId: req.params.proposalId, records });
});

// POST /v1/governance/queue/:id — 提案进时间锁队列
router.post(
    "/governance/queue/:id",
    requireAuth,
    requireRole("dao"),
    rateLimit({ max: 10, windowMs: 60_000 }),
    async (req, res) => {
        try {
            const result = await queueProposal(req.params.id);
            return res.json({ success: true, ...result });
        } catch (err) {
            if (err.code === "GOVERNANCE_RELAY_UNAVAILABLE") {
                return res.status(503).json({ code: 5043, error: err.message });
            }
            return res.status(500).json({ code: 5040, error: err.message });
        }
    }
);

// POST /v1/governance/execute/:id — 执行已通过提案
router.post(
    "/governance/execute/:id",
    requireAuth,
    requireRole("dao"),
    rateLimit({ max: 5, windowMs: 60_000 }),
    async (req, res) => {
        try {
            const result = await executeProposal(req.params.id);
            return res.json({ success: true, ...result });
        } catch (err) {
            if (err.code === "GOVERNANCE_RELAY_UNAVAILABLE") {
                return res.status(503).json({ code: 5043, error: err.message });
            }
            return res.status(500).json({ code: 5041, error: err.message });
        }
    }
);

// POST /v1/governance/cancel/:id — 取消提案
router.post(
    "/governance/cancel/:id",
    requireAuth,
    requireRole("dao"),
    rateLimit({ max: 10, windowMs: 60_000 }),
    async (req, res) => {
        try {
            const result = await cancelProposal(req.params.id);
            return res.json({ success: true, ...result });
        } catch (err) {
            if (err.code === "GOVERNANCE_RELAY_UNAVAILABLE") {
                return res.status(503).json({ code: 5043, error: err.message });
            }
            return res.status(500).json({ code: 5042, error: err.message });
        }
    }
);

// GET /v1/governance/proposals/:id/onchain — 查询链上提案状态
router.get("/governance/proposals/:id/onchain", async (req, res) => {
    const result = await getOnchainProposalState(req.params.id);
    return res.json(result);
});

export default router;
