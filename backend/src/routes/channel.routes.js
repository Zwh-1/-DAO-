/**
 * channelRoutes.js
 * 支付通道与保密转账路由
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isChannelParticipantCheckStrict } from "../config.js";
import { assertChannelParticipant, authedAddressLower } from "../utils/auth-bind.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
    registerChannel,
    getChannel,
    updateChannelState,
    startChannelExit,
    withdrawAfterChallenge,
    closeChannelCooperative,
    validateConfidentialTransferSignals,
    submitConfidentialTransfer,
    validatePrivacyPaymentSignals,
    submitPrivacyPayment,
    validatePrivatePaymentSignals,
    submitPrivatePayment,
    getAllChannels,
} from "../services/paymentChannel.service.js";
import { preVerifyProofPayload } from "../services/zkVerify.service.js";

const router = Router();

// POST /v1/channel/open — 记录新支付通道
router.post("/open", requireAuth, rateLimit({ max: 10, windowMs: 60_000 }), (req, res) => {
    const { channelId, channelAddress, participant1, participant2, totalDeposit } = req.body || {};
    if (!channelId || !participant1 || !participant2 || !totalDeposit) {
        return res.status(400).json({ code: 4060, error: "channelId/participant1/participant2/totalDeposit required" });
    }
    if (isChannelParticipantCheckStrict()) {
        const me = authedAddressLower(req);
        const p1 = String(participant1).toLowerCase();
        const p2 = String(participant2).toLowerCase();
        if (!me || (me !== p1 && me !== p2)) {
            return res.status(403).json({
                code: 9004,
                error: "participant1/participant2 须包含当前登录钱包地址",
            });
        }
    }
    try {
        const record = registerChannel(channelId, { channelAddress, participant1, participant2, totalDeposit });
        return res.status(201).json({ success: true, ...record });
    } catch (err) {
        if (err.code === "CHANNEL_EXISTS") return res.status(409).json({ code: 4061, error: err.message });
        return res.status(500).json({ code: 5020, error: err.message });
    }
});

// GET /v1/channel/all — 列出所有通道（预言机工作台调试用）
router.get("/all", requireAuth, requireRole("oracle"), (_req, res) => {
    return res.json({ channels: getAllChannels() });
});

// GET /v1/channel/:id/state — 查询通道当前状态
router.get("/:id/state", (req, res) => {
    try {
        const ch = getChannel(req.params.id);
        return res.json(ch);
    } catch (err) {
        if (err.code === "CHANNEL_NOT_FOUND") return res.status(404).json({ code: 4062, error: err.message });
        return res.status(500).json({ code: 5021, error: err.message });
    }
});

// POST /v1/channel/:id/update-state — 更新通道状态（双签）
router.post("/:id/update-state", requireAuth, async (req, res) => {
    const { balance1, balance2, nonce, sig1, sig2 } = req.body || {};
    if (!balance1 || !balance2 || nonce === undefined || !sig1 || !sig2) {
        return res.status(400).json({ code: 4063, error: "balance1/balance2/nonce/sig1/sig2 required" });
    }
    try {
        if (isChannelParticipantCheckStrict()) {
            const ch = getChannel(req.params.id);
            if (!assertChannelParticipant(ch, req, res)) return;
        }
        const result = await updateChannelState(req.params.id, balance1, balance2, nonce, sig1, sig2);
        return res.json({ success: true, ...result });
    } catch (err) {
        const map = {
            CHANNEL_NOT_FOUND: [404, 4062],
            NONCE_NOT_INCREASING: [400, 4064],
            AMOUNT_MISMATCH: [400, 4065],
            INVALID_SIG1: [400, 4066],
            INVALID_SIG2: [400, 4067],
        };
        const [status, code] = map[err.code] ?? [500, 5022];
        return res.status(status).json({ code, error: err.message });
    }
});

// POST /v1/channel/:id/start-exit — 发起单方关闭
router.post("/:id/start-exit", requireAuth, async (req, res) => {
    try {
        if (isChannelParticipantCheckStrict()) {
            const ch = getChannel(req.params.id);
            if (!assertChannelParticipant(ch, req, res)) return;
        }
        const result = await startChannelExit(req.params.id);
        return res.json({ success: true, ...result });
    } catch (err) {
        const map = {
            CHANNEL_NOT_FOUND: [404, 4062],
            EXIT_ALREADY_STARTED: [409, 4068],
        };
        const [status, code] = map[err.code] ?? [500, 5023];
        return res.status(status).json({ code, error: err.message });
    }
});

// POST /v1/channel/:id/withdraw — 挑战期结束后提款
router.post("/:id/withdraw", requireAuth, async (req, res) => {
    try {
        if (isChannelParticipantCheckStrict()) {
            const ch = getChannel(req.params.id);
            if (!assertChannelParticipant(ch, req, res)) return;
        }
        const result = await withdrawAfterChallenge(req.params.id);
        return res.json({ success: true, ...result });
    } catch (err) {
        const map = {
            CHANNEL_NOT_FOUND: [404, 4062],
            EXIT_NOT_STARTED: [400, 4069],
            CHALLENGE_PERIOD_NOT_ENDED: [400, 4070],
        };
        const [status, code] = map[err.code] ?? [500, 5024];
        return res.status(status).json({ code, error: err.message });
    }
});

// POST /v1/channel/:id/close — 双方协商关闭通道
router.post("/:id/close", requireAuth, async (req, res) => {
    const { balance1, balance2, nonce, sig1, sig2 } = req.body || {};
    if (!balance1 || !balance2 || nonce === undefined || !sig1 || !sig2) {
        return res.status(400).json({ code: 4063, error: "balance1/balance2/nonce/sig1/sig2 required" });
    }
    try {
        if (isChannelParticipantCheckStrict()) {
            const ch = getChannel(req.params.id);
            if (!assertChannelParticipant(ch, req, res)) return;
        }
        const result = await closeChannelCooperative(req.params.id, balance1, balance2, nonce, sig1, sig2);
        return res.json({ success: true, ...result });
    } catch (err) {
        const map = {
            CHANNEL_NOT_FOUND: [404, 4062],
            AMOUNT_MISMATCH: [400, 4065],
        };
        const [status, code] = map[err.code] ?? [500, 5025];
        return res.status(status).json({ code, error: err.message });
    }
});

// POST /v1/channel/transfer/confidential — 提交保密转账 ZK 证明
router.post("/transfer/confidential", requireAuth, rateLimit({ max: 20, windowMs: 60_000 }), async (req, res) => {
    const { proof, pubSignals } = req.body || {};
    if (!proof || !pubSignals) {
        return res.status(400).json({ code: 4071, error: "proof and pubSignals required" });
    }

    // 格式验证
    const check = validateConfidentialTransferSignals(pubSignals);
    if (!check.ok) return res.status(400).json({ code: check.code, error: check.error });

    // ZK 证明格式预验证
    const zk = preVerifyProofPayload({ proof, publicSignals: pubSignals });
    if (!zk.ok) return res.status(400).json({ code: zk.code, error: zk.error });

    try {
        const result = await submitConfidentialTransfer(pubSignals, proof);
        return res.status(202).json({ success: true, ...result });
    } catch (err) {
        if (err.code === "DUPLICATE_TRANSFER_NULLIFIER") {
            return res.status(409).json({ code: 2002, error: "Transfer nullifier already used" });
        }
        if (String(err.code || "").startsWith("VKEY") || err.code === "VERIFY_FAILED") {
            return res.status(400).json({ code: 4073, error: err.message });
        }
        return res.status(500).json({ code: 5026, error: err.message });
    }
});

// POST /v1/channel/transfer/privacy-payment — 提交隐私支付证明
router.post("/transfer/privacy-payment", requireAuth, rateLimit({ max: 20, windowMs: 60_000 }), async (req, res) => {
    const { proof, pubSignals } = req.body || {};
    if (!proof || !pubSignals) {
        return res.status(400).json({ code: 4072, error: "proof and pubSignals required" });
    }

    const check = validatePrivacyPaymentSignals(pubSignals);
    if (!check.ok) return res.status(400).json({ code: check.code, error: check.error });

    const zk = preVerifyProofPayload({ proof, publicSignals: pubSignals });
    if (!zk.ok) return res.status(400).json({ code: zk.code, error: zk.error });

    try {
        const result = await submitPrivacyPayment(pubSignals, proof);
        return res.status(202).json({ success: true, ...result });
    } catch (err) {
        if (err.code === "DUPLICATE_PRIVACY_NULLIFIER") {
            return res.status(409).json({ code: 2002, error: err.message });
        }
        if (String(err.code || "").startsWith("VKEY") || err.code === "VERIFY_FAILED") {
            return res.status(400).json({ code: 4074, error: err.message });
        }
        return res.status(500).json({ code: 5027, error: err.message });
    }
});

// POST /v1/channel/transfer/private-payment — 提交 private_payment 电路证明
router.post("/transfer/private-payment", requireAuth, rateLimit({ max: 20, windowMs: 60_000 }), async (req, res) => {
    const { proof, pubSignals } = req.body || {};
    if (!proof || !pubSignals) {
        return res.status(400).json({ code: 4075, error: "proof and pubSignals required" });
    }

    const check = validatePrivatePaymentSignals(pubSignals);
    if (!check.ok) return res.status(400).json({ code: check.code, error: check.error });

    const zk = preVerifyProofPayload({ proof, publicSignals: pubSignals });
    if (!zk.ok) return res.status(400).json({ code: zk.code, error: zk.error });

    try {
        const result = await submitPrivatePayment(pubSignals, proof);
        return res.status(202).json({ success: true, ...result });
    } catch (err) {
        if (err.code === "DUPLICATE_PRIVATE_PAYMENT_NULLIFIER") {
            return res.status(409).json({ code: 2002, error: err.message });
        }
        if (String(err.code || "").startsWith("VKEY") || err.code === "VERIFY_FAILED") {
            return res.status(400).json({ code: 4076, error: err.message });
        }
        return res.status(500).json({ code: 5028, error: err.message });
    }
});

export default router;
