pragma circom 2.1.6;

// 使用 circomlib 标准哈希和比较器组件
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// PrivacyBalanceProof — 带 Nullifier 的隐私余额证明电路
//
// 核心职责：
//   - 证明用户余额 ≥ 要求的最低金额
//   - 不暴露具体余额（零知识保护）
//   - 生成 Nullifier 防止双花攻击
//   - 绑定 commitment 作为余额承诺
//
// 隐私承诺：
//   - balance：私有余额（绝不离端）
//   - salt：随机盐值（私有，用于承诺隐藏）
//   - 公开输出：余额承诺 + Nullifier，不暴露余额
//
// 业务场景：
//   - 隐私支付能力验证
//   - 质押金充足性检查
//   - 信用借贷额度证明
//
// 安全性：
//   - 余额强制 < 2^64（支持最大值 ~1.8×10^19）
//   - Nullifier = Poseidon(balance, salt, nullifier_id) 防止双花
//   - commitment = Poseidon(balance, salt) 作为余额承诺
//
// 防双花机制：
//   1. 链下生成 Nullifier 并提交到合约
//   2. 合约标记 Nullifier 为已使用
//   3. 同一余额无法二次证明
//
// 使用示例：
//   component proof = PrivacyBalanceProof();
//   proof.balance <== private_balance;        // 私有
//   proof.salt <== random_salt;               // 私有
//   proof.required_amount <== min_amount;     // 公开
//   proof.nullifier_id <== unique_id;         // 公开（防重放）
//   // proof.balance_commitment 用于链上验证
//   // proof.nullifier 用于防双花
// ═══════════════════════════════════════════════════════════════════════════════

template PrivacyBalanceProof() {
    // ── 私有输入 (Witness — 绝不离端，禁止日志记录) ─────────────────────────
    signal input balance;         // 私有余额（< 2^64）
    signal input salt;            // 随机盐值（用于承诺隐藏）
    
    // ── 公开输入 (Public Inputs — 链上可验证) ───────────────────────────────
    signal input required_amount; // 要求的最低金额（公开）
    signal input nullifier_id;    // Nullifier 唯一 ID（防重放，公开）
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output balance_commitment;  // 余额承诺（链上存储）
    signal output nullifier;           // 防双花 Nullifier（链上验证）
    
    // ── 步骤 1: 域安全约束（防止余额溢出）───────────────────────────────────
    // 余额使用 64-bit，最大值 ~1.8×10^19
    // 对应金额：18,446,744,073,709,551,615（足够支持所有代币精度）
    component balanceRangeCheck = Num2Bits(64);
    balanceRangeCheck.in <== balance;
    
    component saltRangeCheck = Num2Bits(254);
    saltRangeCheck.in <== salt;
    
    // ── 步骤 2: 余额充足性约束 ──────────────────────────────────────────────
    // balance >= required_amount
    component ge = GreaterEqThan(64);
    ge.in[0] <== balance;
    ge.in[1] <== required_amount;
    signal sufficient <== ge.out;
    
    // ── 强制约束：余额必须充足 ─────────────────────────────────────────────
    sufficient === 1;
    
    // ── 步骤 3: 计算余额承诺 ────────────────────────────────────────────────
    // balance_commitment = Poseidon(balance, salt)
    // 链上存储承诺值，不暴露余额
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== balance;
    commitmentHash.inputs[1] <== salt;
    balance_commitment <== commitmentHash.out;
    
    // ── 步骤 4: 计算 Nullifier（防双花）────────────────────────────────────
    // nullifier = Poseidon(balance, salt, nullifier_id)
    // 同一余额 + 盐值 + ID 只能生成一次 Nullifier
    // 链上合约存储已使用的 Nullifier，防止二次证明
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== balance;
    nullifierHash.inputs[1] <== salt;
    nullifierHash.inputs[2] <== nullifier_id;
    nullifier <== nullifierHash.out;
    
    // ── 步骤 5: Nullifier 唯一性约束 ───────────────────────────────────────
    // 强制 nullifier_id < 2^254，防止域溢出
    component nullifierIdRangeCheck = Num2Bits(254);
    nullifierIdRangeCheck.in <== nullifier_id;
}

// ── 导出模板供其他电路引用 ─────────────────────────────────────────────────
// 使用方式：
//   include "./utils/privacy_balance_proof.circom";
//   component proof = PrivacyBalanceProof();
//   proof.balance <== private_balance;
//   proof.salt <== random_salt;
//   proof.required_amount <== min_amount;
//   proof.nullifier_id <== unique_id;  // 例如：keccak256(tx_id)
//   // proof.balance_commitment 和 proof.nullifier 用于链上验证
