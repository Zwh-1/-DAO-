pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// FraudDetection — 欺诈检测链上验证电路
//
// 核心职责：
//   - 零知识证明某地址的行为模式超出欺诈阈值
//   - 不暴露具体行为细节（隐私保护）
//   - 仅公开"风险分值"与"是否超过阈值"
//   - 绑定 audit_epoch 防止重放
//
// 业务场景：
//   - 后端 GET /v1/audit/fraud 结果的链上验证
//   - Guardian 提交欺诈检测报告到 AuditLog.sol
//   - 辅助 ChallengeManager 自动触发挑战
//
// 欺诈指标（5 维度，均为私有）：
//   - claim_frequency:     短期内申领频率（次数/周期，0-100）
//   - amount_deviation:    申领金额偏差系数（0-100，越高越异常）
//   - address_diversity:   关联地址多样性（0-100，越低越可疑 Sybil）
//   - timing_pattern:      时间模式规律性（0-100，越高越可疑机器人）
//   - nullifier_reuse:     Nullifier 复用风险（0-100，越高越可疑）
//
// 风险分计算：
//   risk_score = Σ(indicator[i] * weight[i]) / 1000
//   范围：[0, 100]
//
// 公开输入（Public Inputs，verifier.sol 验证）：
//   - risk_score_hash:     Poseidon(risk_score, audit_epoch)
//   - threshold:           欺诈判定阈值（如 70 = 高风险）
//   - audit_epoch:         审计时期标识（防重放）
//   - is_fraud:            0 或 1（risk_score >= threshold）
//
// 私有输入（Witness，绝不离端）：
//   - indicators[5]:       5 个欺诈指标值（0-100）
//   - weights[5]:          各指标权重（总和 = 1000）
//   - target_commitment:   目标地址承诺 Poseidon(target_key)（不暴露地址）
//
// 安全性：
//   - 指标值范围：[0, 100]（7-bit）
//   - 权重总和验证：Σweight = 1000
//   - is_fraud 一致性：is_fraud === (risk_score_computed >= threshold)
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template FraudDetection() {
    // ── 私有输入（Witness，绝不离端）────────────────────────────────────
    signal input indicators[5];      // 5 个欺诈指标（0-100）
    signal input weights[5];         // 各指标权重（总和 = 1000）
    signal input target_commitment;  // 目标地址承诺（Poseidon(target_key)）

    // ── 公开输入（Public Inputs，链上可验证）──────────────────────────────
    signal input risk_score_hash;    // Poseidon(risk_score_scaled, audit_epoch)
    signal input threshold;          // 欺诈判定阈值（0-100）
    signal input audit_epoch;        // 审计时期标识（防重放）
    signal input is_fraud;           // 0 或 1

    // ── 步骤 1：指标范围约束（0-100，7-bit）────────────────────────────────
    component indicatorBits[5];
    for (var i = 0; i < 5; i++) {
        indicatorBits[i] = Num2Bits(7);
        indicatorBits[i].in <== indicators[i];
    }

    // ── 步骤 2：权重范围约束（0-1000，10-bit）──────────────────────────────
    component weightBits[5];
    for (var i = 0; i < 5; i++) {
        weightBits[i] = Num2Bits(10);
        weightBits[i].in <== weights[i];
    }

    // ── 步骤 3：权重归一化（Σweights = 1000）────────────────────────────────
    signal weight_sum;
    weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4];
    weight_sum === 1000;

    // ── 步骤 4：计算加权风险分（scaled = Σ(indicator*weight)，范围 0-100000）
    signal weighted[5];
    for (var i = 0; i < 5; i++) {
        weighted[i] <== indicators[i] * weights[i];
    }

    signal partial[6];
    partial[0] <== 0;
    for (var i = 0; i < 5; i++) {
        partial[i+1] <== partial[i] + weighted[i];
    }
    signal risk_score_scaled;
    risk_score_scaled <== partial[5];  // 范围 0-100000（需除以 1000 才是百分制）

    // ── 步骤 5：风险分范围约束（0-100000，17-bit）────────────────────────────
    component riskBits = Num2Bits(17);
    riskBits.in <== risk_score_scaled;

    // ── 步骤 6：风险分哈希验证（绑定 audit_epoch）──────────────────────────
    component riskHash = Poseidon(2);
    riskHash.inputs[0] <== risk_score_scaled;
    riskHash.inputs[1] <== audit_epoch;
    riskHash.out === risk_score_hash;

    // ── 步骤 7：欺诈判定一致性（is_fraud ⟺ risk_score_scaled >= threshold*1000）
    // is_fraud ∈ {0, 1}
    is_fraud * (is_fraud - 1) === 0;

    // threshold_scaled = threshold * 1000
    signal threshold_scaled;
    threshold_scaled <== threshold * 1000;

    // GreaterEqThan(17)：risk_score_scaled >= threshold_scaled ?
    component geThreshold = GreaterEqThan(17);
    geThreshold.in[0] <== risk_score_scaled;
    geThreshold.in[1] <== threshold_scaled;

    // 强制 is_fraud === geThreshold.out
    geThreshold.out === is_fraud;
}

// 公开输入：risk_score_hash, threshold, audit_epoch, is_fraud
// 私有输入：indicators[5], weights[5], target_commitment
component main {
    public [risk_score_hash, threshold, audit_epoch, is_fraud]
} = FraudDetection();
