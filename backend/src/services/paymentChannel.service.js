/**
 * paymentChannel.service.js
 * 支付通道与保密转账服务
 *
 * 对接 PaymentChannel.sol：
 *   - 创建通道记录、更新状态（updateState）、发起退出（startExit）
 *   - 结算（closeChannel / withdrawAfterChallenge）
 *   - 验证 confidential_transfer.circom + privacy_payment.circom + private_payment.circom 证明
 *
 * Public signals 顺序：
 *   confidential_transfer: [min_amount, max_amount, transaction_id, amount_commitment, nullifier]
 *   privacy_payment:       [required_amount, nullifier_id, balance_commitment, nullifier]
 *   private_payment:       [old_root, new_root, transaction_id, nullifier]
 */

import { ethers } from "ethers";
import { verifyGroth16Full } from "./circuitVerify.service.js";
import { config } from "../config.js";
import { ABIS } from "../abis/index.js";  // 从统一的 ABI 目录导入
import { verifyChannelStateSignature } from "./eip712.service.js";

// ── 离线通道记录 ──────────────────────────────────────────────────────────────
const _channels = new Map(); // channelId -> { address?, p1, p2, deposit, states[] }
const _transferNullifiers = new Set(); // 保密转账防重放
const _privacyPaymentNullifiers = new Set();
const _privatePaymentNullifiers = new Set();

// ── 合约工厂 ──────────────────────────────────────────────────────────────────

function getChannelContract(channelAddress) {
    if (!config.rpcUrl || !config.relayerPrivateKey) return null;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const relayer = new ethers.Wallet(config.relayerPrivateKey, provider);
    // 使用导入的完整 ABI
    return new ethers.Contract(channelAddress, ABIS.PaymentChannel, relayer);
}

// ── 通道管理 ──────────────────────────────────────────────────────────────────

/**
 * 记录新通道（通道由前端部署合约后后端记录状态）
 */
export function registerChannel(channelId, { channelAddress, participant1, participant2, totalDeposit }) {
    if (_channels.has(channelId)) {
        throw Object.assign(new Error("channel already registered"), { code: "CHANNEL_EXISTS" });
    }
    const record = {
        channelId,
        channelAddress: channelAddress?.toLowerCase() || null,
        participant1: participant1.toLowerCase(),
        participant2: participant2.toLowerCase(),
        totalDeposit: String(totalDeposit),
        currentNonce: 0,
        balance1: String(totalDeposit),
        balance2: "0",
        exitInitiated: false,
        closeRequestedAt: null,
        createdAt: Math.floor(Date.now() / 1000),
        states: [],
    };
    _channels.set(channelId, record);
    return record;
}

/**
 * 获取通道信息
 */
export function getChannel(channelId) {
    const ch = _channels.get(channelId);
    if (!ch) throw Object.assign(new Error("channel not found"), { code: "CHANNEL_NOT_FOUND" });
    return ch;
}

/**
 * 双签验证并更新通道状态
 */
export async function updateChannelState(channelId, balance1, balance2, nonce, sig1, sig2) {
    const ch = getChannel(channelId);

    // Nonce 严格递增
    if (Number(nonce) <= ch.currentNonce) {
        throw Object.assign(new Error("nonce not increasing"), { code: "NONCE_NOT_INCREASING" });
    }

    // 资产守恒
    const total = BigInt(String(balance1)) + BigInt(String(balance2));
    if (total !== BigInt(ch.totalDeposit)) {
        throw Object.assign(new Error("balance sum mismatch total deposit"), { code: "AMOUNT_MISMATCH" });
    }

    // 验证双方签名（EIP-712）
    if (ch.channelAddress) {
        const chainId = config.chainId || 31337;
        const ok1 = verifyChannelStateSignature(ch.participant1, balance1, balance2, nonce, sig1, ch.channelAddress, chainId);
        const ok2 = verifyChannelStateSignature(ch.participant2, balance1, balance2, nonce, sig2, ch.channelAddress, chainId);
        if (!ok1) throw Object.assign(new Error("invalid signature from participant1"), { code: "INVALID_SIG1" });
        if (!ok2) throw Object.assign(new Error("invalid signature from participant2"), { code: "INVALID_SIG2" });
    }

    // 更新本地状态
    ch.currentNonce = Number(nonce);
    ch.balance1 = String(balance1);
    ch.balance2 = String(balance2);
    ch.states.push({ nonce: Number(nonce), balance1: String(balance1), balance2: String(balance2), updatedAt: Date.now() });

    // 链上中继（可选）
    let txHash = null;
    if (ch.channelAddress) {
        const contract = getChannelContract(ch.channelAddress);
        if (contract) {
            const tx = await contract.updateState(
                BigInt(String(balance1)), BigInt(String(balance2)), BigInt(String(nonce)), sig1, sig2
            );
            const receipt = await tx.wait();
            txHash = receipt.hash;
        }
    }

    return { ...ch, txHash };
}

/**
 * 发起单方关闭（挑战期启动）
 */
export async function startChannelExit(channelId) {
    const ch = getChannel(channelId);
    if (ch.exitInitiated) {
        throw Object.assign(new Error("exit already initiated"), { code: "EXIT_ALREADY_STARTED" });
    }
    ch.exitInitiated = true;
    ch.closeRequestedAt = Math.floor(Date.now() / 1000);

    let txHash = null;
    if (ch.channelAddress) {
        const contract = getChannelContract(ch.channelAddress);
        if (contract) {
            const tx = await contract.startExit();
            const receipt = await tx.wait();
            txHash = receipt.hash;
        }
    }

    return { ...ch, challengeEndTime: ch.closeRequestedAt + 86400, txHash };
}

/**
 * 挑战期结束后提款
 */
export async function withdrawAfterChallenge(channelId) {
    const ch = getChannel(channelId);
    if (!ch.exitInitiated) {
        throw Object.assign(new Error("exit not started"), { code: "EXIT_NOT_STARTED" });
    }
    const elapsed = Math.floor(Date.now() / 1000) - (ch.closeRequestedAt || 0);
    if (elapsed < 86400) {
        throw Object.assign(new Error("challenge period not ended"), { code: "CHALLENGE_PERIOD_NOT_ENDED" });
    }

    let txHash = null;
    if (ch.channelAddress) {
        const contract = getChannelContract(ch.channelAddress);
        if (contract) {
            const tx = await contract.withdrawAfterChallenge();
            const receipt = await tx.wait();
            txHash = receipt.hash;
        }
    }

    ch.exitInitiated = false;
    ch.balance1 = "0";
    ch.balance2 = "0";

    return { channelId, settled: true, txHash };
}

/**
 * 双方协商关闭通道
 */
export async function closeChannelCooperative(channelId, balance1, balance2, nonce, sig1, sig2) {
    const ch = getChannel(channelId);

    if (BigInt(String(balance1)) + BigInt(String(balance2)) !== BigInt(ch.totalDeposit)) {
        throw Object.assign(new Error("balance sum mismatch total deposit"), { code: "AMOUNT_MISMATCH" });
    }

    let txHash = null;
    if (ch.channelAddress) {
        const contract = getChannelContract(ch.channelAddress);
        if (contract) {
            const tx = await contract.closeChannel(
                BigInt(String(balance1)), BigInt(String(balance2)), BigInt(String(nonce)), sig1, sig2
            );
            const receipt = await tx.wait();
            txHash = receipt.hash;
        }
    }

    ch.balance1 = "0";
    ch.balance2 = "0";
    ch.exitInitiated = false;

    return { channelId, closed: true, balance1: String(balance1), balance2: String(balance2), txHash };
}

// ── 保密转账验证 ───────────────────────────────────────────────────────────────

/**
 * 验证保密转账 public signals 格式
 * confidential_transfer.circom 公开输入：[min_amount, max_amount, transaction_id, amount_commitment, nullifier]
 */
export function validateConfidentialTransferSignals(pubSignals) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 5) {
        return { ok: false, code: 4020, error: "pubSignals must have exactly 5 elements for confidential_transfer" };
    }
    const [minAmount, maxAmount, transactionId, amountCommitment, nullifier] = pubSignals;
    if (BigInt(String(minAmount)) > BigInt(String(maxAmount))) {
        return { ok: false, code: 4021, error: "min_amount must be <= max_amount" };
    }
    return { ok: true, transactionId: String(transactionId), nullifier: String(BigInt(String(nullifier))) };
}

/**
 * 提交保密转账（记录 nullifier，链下 groth16.verify 当 vkey 存在）
 */
export async function submitConfidentialTransfer(pubSignals, proof) {
    const validation = validateConfidentialTransferSignals(pubSignals);
    if (!validation.ok) throw Object.assign(new Error(validation.error), { code: validation.code });

    const zkv = await verifyGroth16Full("confidential_transfer", proof, pubSignals);
    if (!zkv.ok) throw Object.assign(new Error(zkv.error || "ZK verify failed"), { code: zkv.code || "ZK_VERIFY_FAILED" });

    const { nullifier } = validation;
    if (_transferNullifiers.has(nullifier)) {
        throw Object.assign(new Error("Transfer nullifier already used"), { code: "DUPLICATE_TRANSFER_NULLIFIER" });
    }
    _transferNullifiers.add(nullifier);

    return {
        transactionId: validation.transactionId,
        nullifier,
        amountCommitment: String(BigInt(String(pubSignals[3]))),
        recorded: true,
        zkSkipped: Boolean(zkv.skipped),
    };
}

/**
 * 验证隐私支付能力 public signals
 * privacy_payment.circom 公开输入：[required_amount, nullifier_id, balance_commitment, nullifier]
 */
export function validatePrivacyPaymentSignals(pubSignals) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 4) {
        return { ok: false, code: 4022, error: "pubSignals must have exactly 4 elements for privacy_payment" };
    }
    return {
        ok: true,
        requiredAmount: String(pubSignals[0]),
        nullifierId: String(pubSignals[1]),
        balanceCommitment: String(BigInt(String(pubSignals[2]))),
        nullifier: String(BigInt(String(pubSignals[3]))),
    };
}

/**
 * private_payment.circom 公开输入：[old_root, new_root, transaction_id, nullifier]
 */
export function validatePrivatePaymentSignals(pubSignals) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 4) {
        return { ok: false, code: 4023, error: "pubSignals must have exactly 4 elements for private_payment" };
    }
    return {
        ok: true,
        oldRoot: String(BigInt(String(pubSignals[0]))),
        newRoot: String(BigInt(String(pubSignals[1]))),
        transactionId: String(pubSignals[2]),
        nullifier: String(BigInt(String(pubSignals[3]))),
    };
}

/**
 * 提交隐私支付证明（防 nullifier 重放 + ZK 验证）
 */
export async function submitPrivacyPayment(pubSignals, proof) {
    const validation = validatePrivacyPaymentSignals(pubSignals);
    if (!validation.ok) throw Object.assign(new Error(validation.error), { code: validation.code });

    const zkv = await verifyGroth16Full("privacy_payment", proof, pubSignals);
    if (!zkv.ok) throw Object.assign(new Error(zkv.error || "ZK verify failed"), { code: zkv.code || "ZK_VERIFY_FAILED" });

    const { nullifier } = validation;
    if (_privacyPaymentNullifiers.has(nullifier)) {
        throw Object.assign(new Error("Privacy payment nullifier already used"), { code: "DUPLICATE_PRIVACY_NULLIFIER" });
    }
    _privacyPaymentNullifiers.add(nullifier);

    return { ...validation, recorded: true, zkSkipped: Boolean(zkv.skipped) };
}

/**
 * 提交 private_payment 电路证明
 */
export async function submitPrivatePayment(pubSignals, proof) {
    const validation = validatePrivatePaymentSignals(pubSignals);
    if (!validation.ok) throw Object.assign(new Error(validation.error), { code: validation.code });

    const zkv = await verifyGroth16Full("private_payment", proof, pubSignals);
    if (!zkv.ok) throw Object.assign(new Error(zkv.error || "ZK verify failed"), { code: zkv.code || "ZK_VERIFY_FAILED" });

    const { nullifier } = validation;
    if (_privatePaymentNullifiers.has(nullifier)) {
        throw Object.assign(new Error("Private payment nullifier already used"), { code: "DUPLICATE_PRIVATE_PAYMENT_NULLIFIER" });
    }
    _privatePaymentNullifiers.add(nullifier);

    return { ...validation, recorded: true, zkSkipped: Boolean(zkv.skipped) };
}

export function getAllChannels() {
    return [..._channels.values()];
}
