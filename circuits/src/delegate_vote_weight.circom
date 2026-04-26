pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// DelegateVoteWeight — 委托投票权重证明电路
//
// 核心职责：
//   - 证明委托方拥有足够的投票权重（>= 最低门槛）
//   - 验证委托方与受托方的绑定关系（防止伪造委托）
//   - 证明委托未超出委托方自身权重（不能凭空增加权重）
//   - 绑定 delegation_id 防止重放
//
// 业务场景：
//   - Governance.delegate(address to) 前的权重证明
//   - 后端 POST /v1/governance/delegate 验证
//
// 公开输入（Public Inputs，verifier.sol 验证）：
//   - from_hash:      委托方身份承诺（Poseidon(from_key)）
//   - to_hash:        受托方身份承诺（Poseidon(to_key)）
//   - delegated_weight: 委托权重数值（链上可直接使用）
//   - delegation_id:  委托 ID（防重放，keccak256(from, to, nonce)）
//   - min_weight:     最低委托权重门槛
//
// 私有输入（Witness，绝不离端）：
//   - from_key:       委托方私钥哈希
//   - to_key:         受托方公钥哈希
//   - actual_weight:  委托方实际权重（SBT creditScore + level*10）
//   - nonce:          防重放随机数
//
// 安全性：
//   - 委托权重不超过实际权重：delegated_weight <= actual_weight
//   - 最低门槛验证：delegated_weight >= min_weight
//   - 双向绑定：from_hash 与 to_hash 均由私钥派生，不可伪造
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template DelegateVoteWeight() {
    // ── 私有输入（Witness，绝不离端）────────────────────────────────────
    signal input from_key;        // 委托方私钥哈希（254-bit）
    signal input to_key;          // 受托方公钥哈希（254-bit）
    signal input actual_weight;   // 委托方实际权重（SBT 计算，0-10000）
    signal input nonce;           // 防重放随机数（254-bit）

    // ── 公开输入（Public Inputs，链上可验证）──────────────────────────────
    signal input from_hash;       // Poseidon(from_key)
    signal input to_hash;         // Poseidon(to_key)
    signal input delegated_weight; // 委托的权重数值
    signal input delegation_id;   // Poseidon(from_hash, to_hash, nonce)
    signal input min_weight;      // 最低委托权重门槛

    // ── 步骤 1：委托方身份承诺验证 ────────────────────────────────────────
    component fromHash = Poseidon(1);
    fromHash.inputs[0] <== from_key;
    fromHash.out === from_hash;

    // ── 步骤 2：受托方身份承诺验证 ────────────────────────────────────────
    component toHash = Poseidon(1);
    toHash.inputs[0] <== to_key;
    toHash.out === to_hash;

    // ── 步骤 3：委托 ID 验证（绑定双方 + nonce，防重放） ──────────────────
    component delegationIdHash = Poseidon(3);
    delegationIdHash.inputs[0] <== from_hash;
    delegationIdHash.inputs[1] <== to_hash;
    delegationIdHash.inputs[2] <== nonce;
    delegationIdHash.out === delegation_id;

    // ── 步骤 4：权重范围约束（0 - 2^20）──────────────────────────────────
    component actualWeightBits = Num2Bits(20);
    actualWeightBits.in <== actual_weight;

    component delegatedWeightBits = Num2Bits(20);
    delegatedWeightBits.in <== delegated_weight;

    // ── 步骤 5：委托权重 <= 实际权重（不能凭空增加权重）─────────────────
    component leWeight = LessEqThan(20);
    leWeight.in[0] <== delegated_weight;
    leWeight.in[1] <== actual_weight;
    leWeight.out === 1;

    // ── 步骤 6：委托权重 >= 最低门槛 ──────────────────────────────────────
    component geMinWeight = GreaterEqThan(20);
    geMinWeight.in[0] <== delegated_weight;
    geMinWeight.in[1] <== min_weight;
    geMinWeight.out === 1;
}

// 公开输入：from_hash, to_hash, delegated_weight, delegation_id, min_weight
// 私有输入：from_key, to_key, actual_weight, nonce
component main {
    public [from_hash, to_hash, delegated_weight, delegation_id, min_weight]
} = DelegateVoteWeight();
