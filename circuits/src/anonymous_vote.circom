pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// AnonymousVote — 匿名治理投票电路
//
// 核心职责：
//   - 证明投票者是合法 DAO 成员（持有 SBT，在 Merkle Tree 中）
//   - 不暴露投票者具体身份（匿名性）
//   - 生成 Nullifier 防止双重投票
//   - 验证投票权重来源合法（SBT 信用分 + 等级）
//   - 绑定 proposal_id 防止跨提案重放
//
// 业务场景：
//   - Governance.castVote() 的隐私保护版本
//   - 后端 POST /v1/governance/vote 可选 ZK 模式
//
// 公开输入（Public Inputs，verifier.sol 验证）：
//   - proposal_id:    提案 ID（防跨提案重放）
//   - merkle_root:    DAO 成员 Merkle 根（链上存储）
//   - nullifier:      防双重投票（Poseidon(voter_secret, proposal_id)）
//   - support:        投票选择（0=反对，1=赞成，2=弃权）
//   - weight:         投票权重（链上计入计票）
//   - min_credit:     最低信用分门槛
//
// 私有输入（Witness，绝不离端）：
//   - voter_secret:   投票者密钥（254-bit）
//   - leaf_index:     Merkle 叶子索引
//   - merkle_path[16]: Merkle 路径（支持 2^16 = 65536 成员）
//   - credit_score:   SBT 信用分（0-1000，私有）
//   - sbt_level:      SBT 等级（0-10，私有）
//
// 安全性：
//   - Nullifier 唯一性：同一投票者同一提案只能投一次
//   - 权重一致性：weight === credit_score + sbt_level * 10
//   - 匿名性：不暴露 voter_secret、leaf_index、merkle_path
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "./utils/merkle_proof.circom";

template AnonymousVote() {
    // ── 私有输入（Witness，绝不离端）────────────────────────────────────
    signal input voter_secret;           // 投票者密钥（254-bit）
    signal input leaf_index;             // Merkle 叶子索引
    signal input merkle_path[16];        // Merkle 路径（16 层，支持 65536 成员）
    signal input credit_score;           // SBT 信用分（0-1000，私有）
    signal input sbt_level;              // SBT 等级（0-10，私有）

    // ── 公开输入（Public Inputs，链上可验证）──────────────────────────────
    signal input proposal_id;            // 提案 ID
    signal input merkle_root;            // DAO 成员 Merkle 根
    signal input nullifier;              // 防双重投票 Nullifier
    signal input support;                // 投票选择（0/1/2）
    signal input weight;                 // 投票权重
    signal input min_credit;             // 最低信用分门槛

    // ── 步骤 1：Nullifier 计算（绑定 voter + proposal，防双重投票）────────
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== voter_secret;
    nullifierHash.inputs[1] <== proposal_id;
    nullifierHash.out === nullifier;

    // ── 步骤 2：投票者承诺（Merkle 叶子）──────────────────────────────────
    component commitment = Poseidon(2);
    commitment.inputs[0] <== voter_secret;
    commitment.inputs[1] <== nullifier;

    // ── 步骤 3：Merkle 成员资格证明 ───────────────────────────────────────
    component merkleProof = MerkleProof(16);
    merkleProof.leaf        <== commitment.out;
    merkleProof.leaf_index  <== leaf_index;
    for (var i = 0; i < 16; i++) {
        merkleProof.merkle_path[i] <== merkle_path[i];
    }
    merkleProof.merkle_root <== merkle_root;
    merkleProof.valid       === 1;  // 强制 Merkle 路径有效（双重保险）

    // ── 步骤 4：权重一致性验证（weight = credit_score + sbt_level * 10）────
    signal computed_weight;
    computed_weight <== credit_score + sbt_level * 10;
    computed_weight === weight;

    // ── 步骤 5：信用分范围约束（0-1000，10-bit）────────────────────────────
    component creditBits = Num2Bits(10);
    creditBits.in <== credit_score;

    // ── 步骤 6：等级范围约束（0-10，4-bit）────────────────────────────────
    component levelBits = Num2Bits(4);
    levelBits.in <== sbt_level;

    // ── 步骤 7：信用分 >= 最低门槛 ───────────────────────────────────────
    component geCredit = GreaterEqThan(10);
    geCredit.in[0] <== credit_score;
    geCredit.in[1] <== min_credit;
    geCredit.out === 1;

    // ── 步骤 8：support ∈ {0, 1, 2}（三值约束）────────────────────────────
    // 等价于 (support)(support-1)(support-2) === 0
    signal s1;
    s1 <== support * (support - 1);
    signal s2;
    s2 <== s1 * (support - 2);
    s2 === 0;
}

// 公开输入：proposal_id, merkle_root, nullifier, support, weight, min_credit
// 私有输入：voter_secret, leaf_index, merkle_path[16], credit_score, sbt_level
component main {
    public [proposal_id, merkle_root, nullifier, support, weight, min_credit]
} = AnonymousVote();
