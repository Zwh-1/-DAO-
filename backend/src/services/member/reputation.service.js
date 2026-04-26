/**
 * reputation.service.js
 * 声誉分验证与历史行为锚定服务
 *
 * 对接：
 *   - reputation_verifier.circom：验证 ZK 声誉分证明（5条历史行为→加权得分≥门槛）
 *   - history_anchor.circom：管理历史行为 Merkle 树
 *
 * Public signals：
 *   reputation_verifier: [required_score, reputation_hash]
 *   history_anchor:      [merkle_root, history_hash]
 */

import {
    addLeafToHistoryTree,
    getHistoryProof,
    getHistoryRoot,
} from "../identity/merkleTree.service.js";

// ── 离线存储 ───────────────────────────────────────────────────────────────────
const _reputationRecords = new Map(); // address -> [{ score, hash, verifiedAt }]
const _behaviorHistory = new Map();   // address -> [{ data, hash, level, anchoredAt }]

/**
 * 验证声誉分 ZK 证明的 public signals
 * reputation_verifier.circom 公开输入：[required_score, reputation_hash]
 *
 * @param {string[]} pubSignals          长度 2 的数组
 * @param {number} providedScore         前端声称的声誉分（后端二次验证用）
 * @returns {{ ok, code?, error?, requiredScore, reputationHash }}
 */
export async function validateReputationSignals(pubSignals, providedScore) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 2) {
        return { ok: false, code: 4030, error: "pubSignals must have exactly 2 elements for reputation_verifier" };
    }
    const [requiredScore, reputationHash] = pubSignals;

    // 验证 reputation_hash = Poseidon(total_score) — total_score 由电路内部计算
    // 后端无法重算（缺私有 behaviors/weights），只能验证格式一致性
    return {
        ok: true,
        requiredScore: String(requiredScore),
        reputationHash: String(BigInt(String(reputationHash))),
    };
}

/**
 * 记录声誉分验证结果（ZK 证明通过后调用）
 * @param {string} address
 * @param {string} reputationHash  Poseidon(total_score)
 * @param {string} requiredScore
 * @param {string} proofHash       ZK 证明的摘要（用于审计）
 */
export async function recordReputationVerification(address, reputationHash, requiredScore, proofHash) {
    const key = address.toLowerCase();
    const record = {
        reputationHash,
        requiredScore: Number(requiredScore),
        proofHash,
        verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (!_reputationRecords.has(key)) _reputationRecords.set(key, []);
    _reputationRecords.get(key).push(record);
    return record;
}

/**
 * 获取用户的声誉验证历史
 */
export function getReputationHistory(address) {
    return _reputationRecords.get(address.toLowerCase()) || [];
}

// ── 历史行为锚定 ─────────────────────────────────────────────────────────────

/**
 * 向历史行为 Merkle 树插入新记录
 * @param {string} address         用户地址（仅用于本地索引，不记入链上）
 * @param {string|bigint} historyData  历史行为数据（私有）
 * @param {number} behaviorLevel   行为等级（0-100）
 * @returns {{ historyHash, merkleRoot, leafIndex }}
 */
export async function anchorHistoryBehavior(address, historyData, behaviorLevel) {
    const key = address.toLowerCase();

    // 计算 history_hash = Poseidon(history_data)
    const { leafIndex, merkleRoot, historyHash } = await addLeafToHistoryTree(historyData);

    const record = {
        historyHash,
        behaviorLevel: Number(behaviorLevel),
        leafIndex,
        merkleRoot,
        anchoredAt: Math.floor(Date.now() / 1000),
    };

    if (!_behaviorHistory.has(key)) _behaviorHistory.set(key, []);
    _behaviorHistory.get(key).push(record);

    return record;
}

/**
 * 获取历史行为 Merkle 证明（用于生成 HistoryAnchor ZK 证明）
 */
export async function getHistoryBehaviorProof(historyData) {
    return getHistoryProof(historyData);
}

/**
 * 获取当前历史行为 Merkle 根（链上验证时使用）
 */
export async function getCurrentHistoryRoot() {
    return getHistoryRoot();
}

/**
 * 获取用户历史行为列表（隐私保护：不返回原始 historyData）
 */
export function getUserBehaviorHistory(address) {
    const records = _behaviorHistory.get(address.toLowerCase()) || [];
    // 脱敏：只返回哈希和元数据，不返回原始数据
    return records.map(({ historyHash, behaviorLevel, leafIndex, merkleRoot, anchoredAt }) => ({
        historyHash,
        behaviorLevel,
        leafIndex,
        merkleRoot,
        anchoredAt,
    }));
}

/**
 * 验证 history_anchor.circom 的 public signals
 * [merkle_root, history_hash]
 */
export async function validateHistoryAnchorSignals(pubSignals) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 2) {
        return { ok: false, code: 4031, error: "pubSignals must have exactly 2 elements for history_anchor" };
    }
    const [merkleRoot, historyHash] = pubSignals;
    const currentRoot = await getHistoryRoot();

    if (String(BigInt(String(merkleRoot))) !== String(BigInt(currentRoot))) {
        return { ok: false, code: 4032, error: "merkle_root does not match current history tree root" };
    }
    return { ok: true, merkleRoot: String(merkleRoot), historyHash: String(BigInt(String(historyHash))) };
}
