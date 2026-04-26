/**
 * Challenge 异议挑战路由
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { createChallenge, listChallenges } from "../../storage.js";
import { assertSameWallet } from "../../utils/auth-bind.js";
import { verifyGroth16Full } from "../../services/identity/circuitVerify.service.js";
import { preVerifyProofPayload } from "../../services/identity/zkVerify.service.js";

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

/**
 * POST /v1/challenge/deposit
 * 记录挑战保证金存入（链上 openChallenge 广播后同步到后端）
 *
 * 权限要求：已认证 + Challenger 角色
 * 限流：15 次/分钟
 *
 * 请求体（JSON Schema）：
 * {
 *   "proposalId": "string",     必填
 *   "accused":    "string",     必填，被挑战者地址（0x...）
 *   "stakeWei":   "string",     必填，质押金额（uint256 wei 字符串）
 *   "txHash":     "string",     必填，ChallengeManager.openChallenge() 的 tx hash
 *   "challenger": "string"      必填，挑战者地址
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "proposalId": "string",
 *   "txHash": "string",
 *   "recordedAt": "number"
 * }
 *
 * 链上对应：ChallengeManager.openChallenge(proposalId, accused) payable
 *
 * 错误：
 *   - 400: 缺少必填字段 / stakeWei 格式错误
 *   - 409: 该提案已存在挑战记录
 */
router.post(
    "/deposit",
    requireAuth,
    requireRole("challenger"),
    rateLimit({ max: 15, windowMs: 60_000 }),
    (req, res) => {
        const { proposalId, accused, stakeWei, txHash, challenger } = req.body || {};

        if (!proposalId || !accused || !stakeWei || !txHash || !challenger) {
            return res.status(400).json({
                code: 4105,
                error: "proposalId/accused/stakeWei/txHash/challenger 均为必填",
            });
        }
        if (!/^0x[0-9a-fA-F]{40}$/.test(accused)) {
            return res.status(400).json({ code: 4106, error: "accused 地址格式错误" });
        }

        let stakeNum;
        try {
            stakeNum = BigInt(stakeWei);
            if (stakeNum <= 0n) throw new Error();
        } catch {
            return res.status(400).json({ code: 4107, error: "stakeWei 须为正整数字符串" });
        }

        if (!assertSameWallet(challenger, req, res, "challenger")) return;

        // TODO: 检链上 ChallengeManager 是否已有该 proposalId 的挑战（重放防护）
        return res.status(201).json({
            success: true,
            proposalId: String(proposalId),
            accused: accused.toLowerCase(),
            stakeWei: stakeNum.toString(),
            txHash,
            recordedAt: Math.floor(Date.now() / 1000),
        });
    }
);

/**
 * POST /v1/challenge/withdraw
 * 申请取回挑战保证金（挑战失败后提案专属奖励分配）
 *
 * 权限要求：已认证 + Arbitrator 角色（领取奖励）
 * 限流：10 次/分钟
 *
 * 请求体（JSON Schema）：
 * {
 *   "proposalId": "string",     必填，对应挑战提案 ID
 *   "txHash":     "string"      可选，已广播 claimArbitratorReward() 的 tx
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "proposalId": "string",
 *   "txHash": "string|null",
 *   "requestedAt": "number"
 * }
 *
 * 链上对应：ChallengeManager.claimArbitratorReward(proposalId)
 */
router.post(
    "/withdraw",
    requireAuth,
    requireRole("arbitrator"),
    rateLimit({ max: 10, windowMs: 60_000 }),
    (req, res) => {
        const { proposalId, txHash } = req.body || {};

        if (!proposalId) {
            return res.status(400).json({ code: 4108, error: "proposalId 为必填" });
        }

        // TODO: 验证链上 Challenge 已 Resolved 且 caller 为参与仲裁员
        return res.json({
            success: true,
            proposalId: String(proposalId),
            txHash: txHash ?? null,
            requestedAt: Math.floor(Date.now() / 1000),
        });
    }
);

export default router;
