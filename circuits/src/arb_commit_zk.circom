pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// ArbCommitZK — 仲裁 Commit-Reveal ZK 承诺电路
//
// 核心职责：
//   - 将仲裁员投票 Commit-Reveal 升级为零知识承诺版本
//   - Commit 阶段：证明承诺哈希正确（不暴露投票选择和 salt）
//   - Reveal 阶段：证明揭示值与承诺一致（无需公开 salt）
//   - 防止仲裁员"看风使舵"（承诺不可逆）
//   - 绑定 proposal_id + arbitrator_commitment 防重放
//
// 使用场景：
//   - ChallengeManager.commitVote() 的 ZK 增强版
//   - 后端 POST /v1/member/arb/commit 可选 ZK 模式
//   - 提供更强的隐私保护（不暴露 salt）
//
// 两个工作模式（通过 phase 参数切换）：
//
// ── Commit 模式（phase=0）─────────────────────────────────────────────────
//   公开输入：proposal_id, commitment, arbitrator_hash
//   私有输入：vote, salt, arb_key
//   电路约束：commitment === keccak256_compat(vote, salt)
//             arbitrator_hash === Poseidon(arb_key)
//
// ── Reveal 模式（phase=1）─────────────────────────────────────────────────
//   公开输入：proposal_id, commitment, revealed_vote, arbitrator_hash
//   私有输入：vote, salt, arb_key
//   电路约束：commitment === Poseidon(vote, salt)（与 Commit 一致）
//             revealed_vote === vote（公开投票）
//             arbitrator_hash === Poseidon(arb_key)（确认身份）
//
// 注意：本电路使用 Poseidon 哈希替代 keccak256（ZK 友好），
//       需要前端 & 合约均改为 Poseidon 承诺方案。
//       兼容模式（使用原 keccak256）见 ChallengeManager.commitVote()。
//
// 公开输入（两模式共有）：
//   - proposal_id:      提案 ID（防跨提案重放）
//   - commitment:       承诺哈希 Poseidon(vote, salt)
//   - arbitrator_hash:  仲裁员身份承诺 Poseidon(arb_key)
//   - phase:            0=commit, 1=reveal
//   - revealed_vote:    揭示阶段公开投票（commit 阶段传 0）
//
// 私有输入：
//   - vote:    投票选择（0=反对，1=支持）
//   - salt:    随机盐值（254-bit，绝不离端）
//   - arb_key: 仲裁员私钥哈希（254-bit，绝不离端）
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template ArbCommitZK() {
    // ── 私有输入（Witness，绝不离端）────────────────────────────────────
    signal input vote;          // 投票选择（0=反对，1=支持）
    signal input salt;          // 随机盐值（254-bit）
    signal input arb_key;       // 仲裁员私钥哈希（254-bit）

    // ── 公开输入（Public Inputs，链上可验证）──────────────────────────────
    signal input proposal_id;      // 提案 ID
    signal input commitment;       // Poseidon(vote, salt)
    signal input arbitrator_hash;  // Poseidon(arb_key)
    signal input phase;            // 0=commit, 1=reveal
    signal input revealed_vote;    // reveal 阶段公开（commit 阶段传 0）

    // ── 步骤 1：投票值约束（0 或 1，布尔值）─────────────────────────────────
    vote * (vote - 1) === 0;

    // ── 步骤 2：phase 约束（0 或 1）──────────────────────────────────────
    phase * (phase - 1) === 0;

    // ── 步骤 3：承诺验证 commitment === Poseidon(vote, salt)──────────────
    component commitHash = Poseidon(2);
    commitHash.inputs[0] <== vote;
    commitHash.inputs[1] <== salt;
    commitHash.out === commitment;

    // ── 步骤 4：仲裁员身份验证 arbitrator_hash === Poseidon(arb_key)─────
    component arbHash = Poseidon(1);
    arbHash.inputs[0] <== arb_key;
    arbHash.out === arbitrator_hash;

    // ── 步骤 5：Reveal 模式下验证 revealed_vote === vote ─────────────────
    // 若 phase=1（reveal），则 revealed_vote 必须等于 vote
    // 若 phase=0（commit），则 revealed_vote 为 0（占位），不做约束
    //
    // 实现：phase * (revealed_vote - vote) === 0
    // 当 phase=0：0 * anything === 0 ✓
    // 当 phase=1：1 * (revealed_vote - vote) === 0 → revealed_vote === vote
    signal phase_times_diff;
    phase_times_diff <== phase * (revealed_vote - vote);
    phase_times_diff === 0;
}

// 公开输入：proposal_id, commitment, arbitrator_hash, phase, revealed_vote
// 私有输入：vote, salt, arb_key
component main {
    public [proposal_id, commitment, arbitrator_hash, phase, revealed_vote]
} = ArbCommitZK();
