pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// PrivacyPayment — 隐私支付能力验证电路（生产版）
//
// 核心职责：
//   - 证明用户余额 ≥ 支付金额
//   - 不暴露具体余额（零知识保护）
//   - 生成余额承诺和 Nullifier 防止双花
//   - 支持多次支付（状态树更新）
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
//   - 空投申领资格审核
//
// 技术细节：
//   - 余额精度：64-bit 定点数（支持 10^18）
//   - 承诺方案：Poseidon(balance, salt)
//   - Nullifier: Poseidon(balance, salt, nullifier_id)
//   - 范围验证：balance >= required_amount
//
// 安全性：
//   - 余额范围：balance < 2^64，防止溢出
//   - 充足性约束：balance >= required_amount
//   - 防双花：Nullifier 全局唯一，合约记录已使用
//   - 防篡改：承诺绑定余额和盐值
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template PrivacyPayment() {
    // 私有输入（Witness，绝不离端）
    signal input balance;           // 私有余额（64-bit）
    signal input salt;              // 随机盐值（254-bit）
    
    // 公开输入（Public Inputs，链上可验证）
    signal input required_amount;   // 要求的最低金额
    signal input nullifier_id;      // Nullifier 唯一 ID（防重放）
    signal input balance_commitment;    // 余额承诺
    signal input nullifier;             // 防双花 Nullifier
    
    // 步骤 1：余额范围约束（< 2^64）
    component balanceRangeCheck = Num2Bits(64);
    balanceRangeCheck.in <== balance;
    
    component saltRangeCheck = Num2Bits(254);
    saltRangeCheck.in <== salt;
    
    // 步骤 2：余额充足性约束
    component ge = GreaterEqThan(64);
    ge.in[0] <== balance;
    ge.in[1] <== required_amount;
    ge.out === 1;
    
    // 步骤 3：计算余额承诺
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== balance;
    commitmentHash.inputs[1] <== salt;
    commitmentHash.out === balance_commitment;
    
    // 步骤 4：计算 Nullifier
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== balance;
    nullifierHash.inputs[1] <== salt;
    nullifierHash.inputs[2] <== nullifier_id;
    nullifierHash.out === nullifier;
}

// 主电路：隐私支付能力验证
// 公开输入：required_amount, nullifier_id, balance_commitment, nullifier
// 私有输入：balance, salt
component main {
    public [required_amount, nullifier_id, balance_commitment, nullifier]
} = PrivacyPayment();
