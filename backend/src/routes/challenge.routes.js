/**
 * Challenge 异议挑战路由
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { createChallenge, listChallenges } from "../storage.js";
import { assertSameWallet } from "../utils/auth-bind.js";
import { verifyGroth16Full } from "../services/circuitVerify.service.js";
import { preVerifyProofPayload } from "../services/zkVerify.service.js";

const router = Router();

/**
 * POST /v1/challenge/verify-anti-sybil-claim
 * 链下校验 anti_sybil_claim.circom（3 个 public）
 */
router.post(
    "/verify-anti-sybil-claim",
    rateLimit({ max: 40, windowMs: 60_000 }),
    async (req, res) => {
        const body = req.body || {};
        const pub = body.pubSignals || body.publicSignals;
        const zk = preVerifyProofPayload({ proof: body.proof, publicSignals: pub });
        if (!zk.ok) {
            return res.status(400).json({ code: 4102, error: zk.error });
        }
        if (!Array.isArray(pub) || pub.length !== 3) {
            return res.status(400).json({
                code: 4103,
                error: "pubSignals/publicSignals must have exactly 3 elements for anti_sybil_claim",
            });
        }
        const full = await verifyGroth16Full("anti_sybil_claim", body.proof, pub);
        if (!full.ok && !full.skipped) {
            return res.status(400).json({
                code: 4104,
                error: full.error || "ZK verify failed",
                detail: full.code,
            });
        }
        return res.json({ success: true, skipped: Boolean(full.skipped) });
    }
);

/**
 * POST /v1/challenge/init
 */
router.post(
    "/init",
    requireAuth,
    requireRole("challenger"),
    rateLimit({ max: 15, windowMs: 60_000 }),
    (req, res) => {
        const body = req.body || {};
        const {
            proposalId,
            reasonCode,
            evidenceSnapshot,
            txHash,
            challenger,
            stakeAmount,
        } = body;

        if (!proposalId || !reasonCode || !evidenceSnapshot || !txHash || !challenger || stakeAmount === undefined) {
            return res.status(400).json({
                code: 4100,
                error: "proposalId/reasonCode/evidenceSnapshot/txHash/challenger/stakeAmount required",
            });
        }

        if (!assertSameWallet(challenger, req, res, "challenger")) {
            return;
        }

        try {
            const row = createChallenge({
                proposalId: String(proposalId),
                reasonCode: String(reasonCode),
                evidenceSnapshot: String(evidenceSnapshot),
                txHash: String(txHash),
                challenger: String(challenger),
                stakeAmount: Number(stakeAmount),
            });
            return res.status(201).json(row);
        } catch (err) {
            if (err.code === "INSUFFICIENT_CHALLENGE_STAKE") {
                return res.status(400).json({ code: 4101, error: err.message });
            }
            return res.status(500).json({ code: 5100, error: err.message });
        }
    },
);

/**
 * GET /v1/challenge/list
 * Query: challenger (optional filter)
 */
router.get(
    "/list",
    requireAuth,
    requireRole("challenger"),
    (req, res) => {
        const addr = String(req.auth.address).toLowerCase();
        const rows = listChallenges({ challenger: addr });
        return res.json({ challenges: rows });
    },
);

export default router;
