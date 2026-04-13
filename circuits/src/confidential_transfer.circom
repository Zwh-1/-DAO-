pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// ConfidentialTransfer — 保密转账验证电路（生产版）
//
// 核心职责：
//   - 证明转账金额在有效范围内 [min_amount, max_amount]
//   - 不暴露具体转账金额（零知识保护）
//   - 生成金额承诺和 Nullifier 防止双花和金额泄露
//   - 支持任意 ERC20 代币精度（通过 64-bit 定点数）
//
// 隐私承诺：
//   - amount：转账金额（私有，完全保密）
//   - salt：随机盐值（私有，用于承诺隐藏）
//   - 公开输出：金额承诺 + Nullifier，不暴露金额
//
// 业务场景：
//   - 隐私转账（隐藏交易金额）
//   - 合规支付（证明金额在监管范围内）
//   - 保密交易（保护交易双方隐私）
//   - 空投分发（证明分发金额有效性）
//
// 技术细节：
//   - 金额精度：64-bit 定点数（支持 10^18，类似 ERC20）
//   - 范围证明：使用位分解和比较器约束
//   - 承诺方案：Poseidon(amount, salt)
//   - Nullifier: Poseidon(amount, salt, transaction_id)
//
// 安全性：
//   - 金额范围：强制 amount ∈ [min_amount, max_amount]
//   - 位宽约束：amount < 2^64，防止溢出
//   - 防双花：Nullifier 全局唯一，合约记录已使用
//   - 防篡改：承诺绑定金额和盐值
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template ConfidentialTransfer() {
    // 私有输入（Witness，绝不离端）
    signal input amount;                // 转账金额（64-bit）
    signal input salt;                  // 随机盐值（254-bit）
    
    // 公开输入（Public Inputs，链上可验证）
    signal input min_amount;            // 最小金额限制
    signal input max_amount;            // 最大金额限制
    signal input transaction_id;        // 交易 ID（防重放）
    signal input amount_commitment;     // 金额承诺
    signal input nullifier;             // 防双花 Nullifier
    
    // ── 步骤 1: 金额位宽约束（防止溢出）───────────────────────────────────
    // 强制 amount < 2^64（最大值 ~1.8×10^19，足够支持所有代币精度）
    component amountRangeCheck = Num2Bits(64);
    amountRangeCheck.in <== amount;
    
    component saltRangeCheck = Num2Bits(254);
    saltRangeCheck.in <== salt;
    
    // 步骤 2：金额下界约束（amount >= min_amount）
    component ge = GreaterEqThan(64);
    ge.in[0] <== amount;
    ge.in[1] <== min_amount;
    ge.out === 1;
    
    // 步骤 3：金额上界约束（amount <= max_amount）
    component le = LessEqThan(64);
    le.in[0] <== amount;
    le.in[1] <== max_amount;
    le.out === 1;
    
    // 步骤 4：计算金额承诺（Poseidon(amount, salt)）
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== amount;
    commitmentHash.inputs[1] <== salt;
    commitmentHash.out === amount_commitment;
    
    // 步骤 5：计算 Nullifier（Poseidon(amount, salt, transaction_id)）
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== amount;
    nullifierHash.inputs[1] <== salt;
    nullifierHash.inputs[2] <== transaction_id;
    nullifierHash.out === nullifier;
}

// 主电路：保密转账验证
// 公开输入：min_amount, max_amount, transaction_id, amount_commitment, nullifier
// 私有输入：amount, salt
component main {
    public [min_amount, max_amount, transaction_id, amount_commitment, nullifier]
} = ConfidentialTransfer();
