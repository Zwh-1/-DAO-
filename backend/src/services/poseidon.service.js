/**
 * poseidon.service.js
 * 链下 Poseidon 哈希工具集
 *
 * 计算与电路层严格对齐的哈希值：
 *  - identity_commitment = Poseidon(social_id_hash, secret, trapdoor)
 *  - nullifier_hash      = Poseidon(secret, project_id)
 *  - merkle_leaf         = Poseidon(identity_commitment, user_level)
 *  - parameter_hash      = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, project_id)
 *  - anonymous_nullifier  = Poseidon(secret, airdrop_id)
 *  - anonymous_commitment = Poseidon(secret, nullifier)
 *  - amount_commitment   = Poseidon(amount, salt)
 *  - transfer_nullifier  = Poseidon(amount, salt, transaction_id)
 *
 * 安全约束：secret / trapdoor / social_id_hash 绝不记录日志。
 */

import { buildPoseidon } from "circomlibjs";

let _poseidon = null;

async function getPoseidon() {
  if (!_poseidon) {
    _poseidon = await buildPoseidon();
  }
  return _poseidon;
}

/**
 * 通用 Poseidon 哈希（返回 BigInt）
 */
export async function poseidonHash(inputs) {
  const poseidon = await getPoseidon();
  const result = poseidon(inputs.map((x) => BigInt(String(x))));
  return poseidon.F.toObject(result);
}

/**
 * 通用 Poseidon 哈希（返回十进制字符串，适合 JSON 序列化）
 */
export async function poseidonHashStr(inputs) {
  return String(await poseidonHash(inputs));
}

// ── 身份承诺（与 identity_commitment.circom + anti_sybil_verifier.circom 对齐）──

/**
 * 计算身份承诺 = Poseidon(social_id_hash, secret, trapdoor)
 * @param {bigint|string} socialIdHash  Web2 社交 ID 的 BN128 安全域哈希（须 < 2^254）
 * @param {bigint|string} secret        Semaphore 身份秘钥（私有，绝不离端）
 * @param {bigint|string} trapdoor      Semaphore 陷门（私有，绝不离端）
 * @returns {string}
 */
export async function computeIdentityCommitment(socialIdHash, secret, trapdoor) {
  return poseidonHashStr([socialIdHash, secret, trapdoor]);
}

/**
 * 计算 Merkle 叶子 = Poseidon(identity_commitment, user_level)
 * 与 anti_sybil_verifier.circom 步骤 3 对齐
 */
export async function computeMerkleLeaf(identityCommitment, userLevel) {
  return poseidonHashStr([identityCommitment, userLevel]);
}

// ── 防重放 Nullifier ──────────────────────────────────────────────────────────

/**
 * 计算 anti-sybil nullifier = Poseidon(secret, airdrop_project_id)
 * 与 anti_sybil_verifier.circom 步骤 5 对齐
 */
export async function computeAntiSybilNullifier(secret, airdropProjectId) {
  return poseidonHashStr([secret, airdropProjectId]);
}

/**
 * 计算 anonymous claim nullifier = Poseidon(secret, airdrop_id)
 * 与 anonymous_claim.circom 步骤 1 对齐
 */
export async function computeAnonymousNullifier(secret, airdropId) {
  return poseidonHashStr([secret, airdropId]);
}

/**
 * 计算 anonymous claim commitment = Poseidon(secret, nullifier)
 * 与 anonymous_claim.circom 步骤 2 对齐
 */
export async function computeAnonymousCommitment(secret, nullifier) {
  return poseidonHashStr([secret, nullifier]);
}

// ── 参数聚合哈希（Gas 优化：减少链上公开输入数量）────────────────────────────

/**
 * 计算参数聚合哈希 = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, project_id)
 * 与 anti_sybil_verifier.circom 步骤 9（parameter_hash）对齐
 * Gas 优化：从 6 个公开输入减少到 1 个
 */
export async function computeParameterHash(minLevel, minAmount, maxAmount, tsStart, tsEnd, projectId) {
  return poseidonHashStr([minLevel, minAmount, maxAmount, tsStart, tsEnd, projectId]);
}

// ── 保密转账承诺（与 confidential_transfer.circom + privacy_payment.circom 对齐）──

/**
 * 计算金额承诺 = Poseidon(amount, salt)
 * 与 confidential_transfer.circom 步骤 4 对齐
 */
export async function computeAmountCommitment(amount, salt) {
  return poseidonHashStr([amount, salt]);
}

/**
 * 计算保密转账 Nullifier = Poseidon(amount, salt, transaction_id)
 * 与 confidential_transfer.circom 步骤 5 对齐
 */
export async function computeTransferNullifier(amount, salt, transactionId) {
  return poseidonHashStr([amount, salt, transactionId]);
}

/**
 * 计算隐私支付 Nullifier = Poseidon(balance, salt, nullifier_id)
 * 与 privacy_payment.circom 步骤 4 对齐
 */
export async function computePrivacyPaymentNullifier(balance, salt, nullifierId) {
  return poseidonHashStr([balance, salt, nullifierId]);
}

/**
 * 计算余额承诺 = Poseidon(balance, salt)
 * 与 privacy_payment.circom 步骤 3 对齐
 */
export async function computeBalanceCommitment(balance, salt) {
  return poseidonHashStr([balance, salt]);
}

// ── 声誉系统（与 reputation_verifier.circom 对齐）──────────────────────────

/**
 * 计算声誉分哈希 = Poseidon(total_score)
 * 与 reputation_verifier.circom 步骤 7 对齐
 */
export async function computeReputationHash(totalScore) {
  return poseidonHashStr([totalScore]);
}

/**
 * 计算历史行为哈希 = Poseidon(history_data)
 * 与 history_anchor.circom 步骤 5 对齐
 */
export async function computeHistoryHash(historyData) {
  return poseidonHashStr([historyData]);
}

// ── 多签提案（与 multi_sig_proposal.circom 对齐）─────────────────────────────

/**
 * 计算多签授权哈希 = Poseidon(total_weighted_votes, proposal_id, 1n)
 * 与 multi_sig_proposal.circom 步骤 5 对齐（threshold_met = 1）
 */
export async function computeMultiSigAuthHash(totalWeightedVotes, proposalId) {
  return poseidonHashStr([totalWeightedVotes, proposalId, 1n]);
}

/**
 * 将 Keccak256 哈希映射到 BN128 安全标量域（< 2^254）
 * 链下预处理 social_id_hash 时必须使用此方法
 * BN128 曲线素数域 p ≈ 2^254.7；Keccak256 输出 256 位须截取低 254 位确保域内
 */
export function keccakToBn128Field(hexOrBigInt) {
  const MASK_254 = (1n << 254n) - 1n;
  const val = typeof hexOrBigInt === "bigint" ? hexOrBigInt : BigInt(hexOrBigInt);
  return String(val & MASK_254);
}
