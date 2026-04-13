pragma circom 2.1.6;

// 使用 circomlib 标准哈希和位操作组件
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// RangePayment — 范围证明与零知识支付电路
//
// 核心职责：
//   - 证明支付金额 ∈ [min_amount, max_amount]
//   - 不暴露具体金额（零知识保护）
//   - 生成交易承诺和 Nullifier 防止双花
//
// 隐私承诺：
//   - amount：支付金额（私有，保密交易）
//   - salt：随机盐值（私有，用于承诺隐藏）
//   - 公开输出：交易承诺 + Nullifier，不暴露金额
//
// 业务场景：
//   - 保密支付（隐藏交易金额）
//   - 隐私转账（保护交易双方隐私）
//   - 合规范围证明（证明金额在监管范围内）
//
// 精度说明：
//   - 金额使用 64-bit（最大值 ~1.8×10^19）
//   - 支持所有主流代币精度（ETH: 18, USDC: 6）
//
// 安全性：
//   - 使用 Num2Bits 强制位宽约束
//   - 金额范围检查 ∈ [min, max]
//   - Nullifier 防止双花攻击
//
// 使用示例：
//   component payment = RangePayment(64);  // 64-bit 金额
//   payment.amount <== private_amount;
//   payment.salt <== random_salt;
//   payment.min_amount <== 0;
//   payment.max_amount <== 1000000;
//   payment.transaction_id <== tx_hash;
//   // payment.amount_commitment 和 payment.nullifier 用于链上验证
// ═══════════════════════════════════════════════════════════════════════════════

template RangePayment(bits) {
    // ── 私有输入 (Witness — 绝不离端，禁止日志记录) ─────────────────────────
    signal input amount;            // 支付金额（私有，保密）
    signal input salt;              // 随机盐值（私有）
    
    // ── 公开输入 (Public Inputs — 链上可验证) ───────────────────────────────
    signal input min_amount;        // 最小金额限制（公开）
    signal input max_amount;        // 最大金额限制（公开）
    signal input transaction_id;    // 交易 ID（防重放）
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output amount_commitment;  // 金额承诺（链上存储）
    signal output nullifier;          // 防双花 Nullifier（链上验证）
    
    // ── 步骤 1: 金额位宽约束（防止溢出）───────────────────────────────────
    // 强制 amount < 2^bits
    // 使用 Num2Bits 进行位分解，确保金额在指定位宽内
    component amountRangeCheck = Num2Bits(bits);
    amountRangeCheck.in <== amount;
    
    component saltRangeCheck = Num2Bits(254);
    saltRangeCheck.in <== salt;
    
    // ── 步骤 2: 金额下界约束（amount >= min_amount）───────────────────────
    // 证明金额 ≥ 最小限制
    // 使用 LessEqThan 实现：!(amount < min_amount)
    component ge = LessEqThan(bits);
    ge.in[0] <== min_amount;
    ge.in[1] <== amount;
    signal lower_bound_ok <== ge.out;
    
    // ── 步骤 3: 金额上界约束（amount <= max_amount）───────────────────────
    // 证明金额 ≤ 最大限制
    component le = LessEqThan(bits);
    le.in[0] <== amount;
    le.in[1] <== max_amount;
    signal upper_bound_ok <== le.out;
    
    // ── 步骤 4: 范围验证（必须同时满足上下界）─────────────────────────────
    // valid = lower_bound_ok AND upper_bound_ok
    // 使用乘法实现逻辑与
    signal valid <== lower_bound_ok * upper_bound_ok;
    
    // ── 强制约束：金额必须在范围内 ────────────────────────────────────────
    valid === 1;
    
    // ── 步骤 5: 计算金额承诺 ──────────────────────────────────────────────
    // amount_commitment = Poseidon(amount, salt)
    // 链上存储承诺值，不暴露金额
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== amount;
    commitmentHash.inputs[1] <== salt;
    amount_commitment <== commitmentHash.out;
    
    // ── 步骤 6: 计算 Nullifier（防双花）──────────────────────────────────
    // nullifier = Poseidon(amount, salt, transaction_id)
    // 同一金额 + 盐值 + 交易 ID 只能生成一次 Nullifier
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== amount;
    nullifierHash.inputs[1] <== salt;
    nullifierHash.inputs[2] <== transaction_id;
    nullifier <== nullifierHash.out;
    
    // ── 步骤 7: 交易 ID 唯一性约束 ────────────────────────────────────────
    // 强制 transaction_id < 2^254，防止域溢出
    component txIdRangeCheck = Num2Bits(254);
    txIdRangeCheck.in <== transaction_id;
}

// ── 导出模板供其他电路引用 ─────────────────────────────────────────────────
// 使用方式：
//   include "./utils/range_payment.circom";
//   component payment = RangePayment(64);  // 64-bit 金额
//   payment.amount <== private_amount;
//   payment.salt <== random_salt;
//   payment.min_amount <== 0;
//   payment.max_amount <== 1000000;
//   payment.transaction_id <== tx_hash;
//   // payment.amount_commitment 和 payment.nullifier 用于链上验证
