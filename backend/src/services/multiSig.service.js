/**
 * multiSig.service.js
 * 多签提案 ZK 验证服务
 *
 * 对接 multi_sig_proposal.circom：
 *   - 验证 public signals：[proposal_id, threshold, auth_hash]
 *   - 本地记录多签授权哈希（供 Governance 查询）
 *
 * 安全说明：
 *   - signer_keys、voted、weights 均为私有见证人，由用户端本地生成证明
 *   - 后端只接收 ZK 证明 + public signals，不接触私有数据
 */

import { ethers } from "ethers";
import { ABIS } from "../abis/index.js";  // 从统一的 ABI 目录导入
import { computeMultiSigAuthHash } from "./poseidon.service.js";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";

// ── 离线记录 ──────────────────────────────────────────────────────────────────
const _multiSigVerifications = new Map(); // proposalId -> [{ authHash, threshold, verifiedAt }]

// ── Governance 合约 ABI（从 abis/index.js 导入）───────────────────────────────
// 说明：使用完整 ABI 而非最小化接口，确保与链上合约完全兼容

let _govContract = null;

function getGovernanceContract() {
    if (!config.rpcUrl || !config.relayerPrivateKey || !config.governanceAddress) return null;
    if (!_govContract) {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const relayer = new ethers.Wallet(config.relayerPrivateKey, provider);
        // 使用导入的完整 ABI
        _govContract = new ethers.Contract(config.governanceAddress, ABIS.Governance, relayer);
    }
    return _govContract;
}

// ── 多签 ZK 验证 ──────────────────────────────────────────────────────────────

/**
 * 验证 multi_sig_proposal.circom 的 public signals
 * [proposal_id, threshold, auth_hash]
 */
export function validateMultiSigSignals(pubSignals) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 3) {
        return { ok: false, code: 4040, error: "pubSignals must have exactly 3 elements for multi_sig_proposal" };
    }
    const [proposalId, threshold, authHash] = pubSignals;

    try {
        return {
            ok: true,
            proposalId: String(BigInt(String(proposalId))),
            threshold: String(BigInt(String(threshold))),
            authHash: String(BigInt(String(authHash))),
        };
    } catch {
        return { ok: false, code: 4041, error: "invalid public signal values" };
    }
}

/**
 * 记录多签验证结果（ZK 证明通过后调用）；若已配置 DB 则持久化。
 */
export async function recordMultiSigVerification(proposalId, authHash, threshold) {
    const record = {
        proposalId: String(proposalId),
        authHash,
        threshold: String(threshold),
        verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (!_multiSigVerifications.has(proposalId)) {
        _multiSigVerifications.set(proposalId, []);
    }
    _multiSigVerifications.get(proposalId).push(record);

    const pool = getPool();
    if (pool) {
        try {
            await pool.execute(
                "INSERT INTO multisig_verifications (proposal_id, auth_hash, threshold, verified_at) VALUES (?, ?, ?, ?)",
                [record.proposalId, record.authHash, record.threshold, record.verifiedAt]
            );
        } catch (e) {
            console.warn("[multisig] DB insert failed, memory only:", e.message);
        }
    }
    return record;
}

/**
 * 查询提案的多签验证记录（优先 DB）
 */
export async function getMultiSigVerifications(proposalId) {
    const pid = String(proposalId);
    const pool = getPool();
    if (pool) {
        try {
            const [rows] = await pool.execute(
                "SELECT proposal_id AS proposalId, auth_hash AS authHash, threshold, verified_at AS verifiedAt FROM multisig_verifications WHERE proposal_id = ? ORDER BY verified_at ASC",
                [pid]
            );
            if (rows?.length) {
                return rows.map((r) => ({
                    proposalId: String(r.proposalId),
                    authHash: r.authHash,
                    threshold: String(r.threshold),
                    verifiedAt: Number(r.verifiedAt),
                }));
            }
        } catch (e) {
            console.warn("[multisig] DB read failed, fallback memory:", e.message);
        }
    }
    return _multiSigVerifications.get(pid) || [];
}

// ── Governance 链上操作 ───────────────────────────────────────────────────────

/**
 * 将提案推入时间锁队列（Governance.queue）
 */
export async function queueProposal(proposalId) {
    const gov = getGovernanceContract();
    if (!gov) {
        if (config.nodeEnv === "production") {
            const err = new Error("Governance 链上中继未配置：生产环境禁止假排队成功");
            err.code = "GOVERNANCE_RELAY_UNAVAILABLE";
            throw err;
        }
        return { proposalId, queued: true, mode: "offchain" };
    }
    const tx = await gov.queue(BigInt(String(proposalId)));
    const receipt = await tx.wait();
    return { proposalId, queued: true, txHash: receipt.hash, mode: "onchain" };
}

/**
 * 执行已过时间锁的提案（Governance.execute）
 */
export async function executeProposal(proposalId) {
    const gov = getGovernanceContract();
    if (!gov) {
        if (config.nodeEnv === "production") {
            const err = new Error("Governance 链上中继未配置：生产环境禁止假执行成功");
            err.code = "GOVERNANCE_RELAY_UNAVAILABLE";
            throw err;
        }
        return { proposalId, executed: true, mode: "offchain" };
    }
    const tx = await gov.execute(BigInt(String(proposalId)));
    const receipt = await tx.wait();
    return { proposalId, executed: true, txHash: receipt.hash, mode: "onchain" };
}

/**
 * 取消提案（Governance.cancel）
 */
export async function cancelProposal(proposalId) {
    const gov = getGovernanceContract();
    if (!gov) {
        if (config.nodeEnv === "production") {
            const err = new Error("Governance 链上中继未配置：生产环境禁止假取消成功");
            err.code = "GOVERNANCE_RELAY_UNAVAILABLE";
            throw err;
        }
        return { proposalId, cancelled: true, mode: "offchain" };
    }
    const tx = await gov.cancel(BigInt(String(proposalId)));
    const receipt = await tx.wait();
    return { proposalId, cancelled: true, txHash: receipt.hash, mode: "onchain" };
}

/**
 * 查询提案链上状态
 */
export async function getOnchainProposalState(proposalId) {
    const gov = getGovernanceContract();
    if (!gov) return { proposalId, state: null, source: "unavailable" };
    const stateNum = await gov.state(BigInt(String(proposalId)));
    const stateLabels = ["Pending", "Active", "Succeeded", "Defeated", "Queued", "Executed", "Cancelled"];
    return {
        proposalId,
        state: Number(stateNum),
        stateLabel: stateLabels[Number(stateNum)] || "Unknown",
        source: "onchain",
    };
}
