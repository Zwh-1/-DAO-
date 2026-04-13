pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// PrivatePayment — 隐私支付状态更新电路（生产版）
//
// 核心职责：
//   - 验证旧余额在旧状态根中（Merkle 证明）
//   - 验证新余额 = 旧余额 - 交易金额（余额充足）
//   - 验证新余额在新状态根中（更新后的 Merkle 证明）
//   - 生成 Nullifier 防止双花攻击
//   - 支持多次交易（状态树动态更新）
//
// 隐私承诺：
//   - old_balance：旧余额（私有）
//   - new_balance：新余额（私有）
//   - amount：交易金额（私有）
//   - balance_index：余额在树中的位置（私有）
//   - 公开输出：新旧状态根、Nullifier，不暴露余额
//
// 业务场景：
//   - 隐私支付（隐藏余额和金额）
//   - 动态余额更新
//   - 状态通道交易
//   - 多次支付支持
//
// 技术细节：
//   - 树深度：20 层（支持 2^20 = 1,048,576 个用户）
//   - 余额精度：64-bit 定点数（* 10^18）
//   - Nullifier: Poseidon(old_balance, secret, transaction_id)
//   - 手动展开：20 层 Merkle 路径验证（避免 Circom 循环限制）
//
// 安全性：
//   - 余额充足：old_balance >= amount
//   - 余额计算：new_balance = old_balance - amount
//   - 防双花：Nullifier 全局唯一，合约记录已使用
//   - 状态一致：新旧状态根必须匹配 Merkle 证明
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "utils/merkle_proof.circom";  // 通用 Merkle 证明组件（优化版）

template PrivatePayment() {
    // 私有输入（Witness，绝不离端）
    signal input old_balance;           // 旧余额（64-bit）
    signal input new_balance;           // 新余额（64-bit）
    signal input amount;                // 交易金额（64-bit）
    signal input balance_index;         // 余额索引（20-bit）
    signal input old_path[20];          // 旧 Merkle 路径
    signal input new_path[20];          // 新 Merkle 路径
    signal input secret;                // 用户密钥（254-bit）
    
    // 公开输入（Public Inputs，链上可验证）
    signal input old_root;              // 旧状态根
    signal input new_root;              // 新状态根
    signal input transaction_id;        // 交易 ID（防重放）
    signal input nullifier;             // 防双花 Nullifier
    
    // ── 步骤 1: 余额范围约束（64-bit）──────────────────────────────────
    // 安全约束：强制余额在 64-bit 范围内，防止溢出攻击
    component oldBalanceRangeCheck = Num2Bits(64);
    oldBalanceRangeCheck.in <== old_balance;
    
    component newBalanceRangeCheck = Num2Bits(64);
    newBalanceRangeCheck.in <== new_balance;
    
    component amountRangeCheck = Num2Bits(64);
    amountRangeCheck.in <== amount;
    
    // ── 步骤 2: 余额充足性约束（old_balance >= amount）────────────────
    component ge = GreaterEqThan(64);
    ge.in[0] <== old_balance;
    ge.in[1] <== amount;
    signal sufficient <== ge.out;
    sufficient === 1;
    
    // ── 步骤 3: 新余额计算约束（new_balance = old_balance - amount）───
    new_balance + amount === old_balance;
    
    // ── 步骤 4: 旧余额 Merkle 证明（使用通用组件）────────────────────
    // 性能优化：使用 MerkleProof(20) 代替手动展开 20 层
    // 减少代码行数：从 150 行减少到 10 行
    component oldMerkleProof = MerkleProof(20);
    oldMerkleProof.leaf <== old_balance;
    oldMerkleProof.leaf_index <== balance_index;
    for (var i = 0; i < 20; i++) {
        oldMerkleProof.merkle_path[i] <== old_path[i];
    }
    oldMerkleProof.merkle_root <== old_root;
    // oldMerkleProof.valid === 1 已内部强制约束
    
    // ── 步骤 6: 新余额 Merkle 证明（使用通用组件）──────────────────
    // 性能优化：复用 MerkleProof(20)，消除重复代码
    component newMerkleProof = MerkleProof(20);
    newMerkleProof.leaf <== new_balance;
    newMerkleProof.leaf_index <== balance_index;  // 复用同一个索引
    for (var i = 0; i < 20; i++) {
        newMerkleProof.merkle_path[i] <== new_path[i];
    }
    newMerkleProof.merkle_root <== new_root;
    // newMerkleProof.valid === 1 已内部强制约束
    
    // ── 步骤 7: 计算 Nullifier（防双花）───────────────────────────────
    // 安全设计：Nullifier = Poseidon(old_balance, secret, transaction_id)
    // - old_balance：确保同一余额只能花费一次
    // - secret：用户私有密钥，防止他人伪造
    // - transaction_id：交易唯一标识，防止跨交易重放
    // 合约层必须记录已使用的 Nullifier，拒绝重复交易
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== old_balance;
    nullifierHash.inputs[1] <== secret;
    nullifierHash.inputs[2] <== transaction_id;
    signal computed_nullifier <== nullifierHash.out;
    
    // 验证 Nullifier 一致性
    nullifier === computed_nullifier;
}

// ── 主电路：隐私支付状态更新 ───────────────────────────────────────────
// 公开输入：old_root, new_root, transaction_id, nullifier
// 私有输入：old_balance, new_balance, amount, balance_index, old_path[20], new_path[20], secret
// 验证逻辑：余额充足 + 状态更新 + Merkle 证明 + Nullifier 唯一性
component main { 
    public [
        old_root, 
        new_root, 
        transaction_id, 
        nullifier
    ] 
} = PrivatePayment();
