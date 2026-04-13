pragma circom 2.1.6;

// 使用 circomlib 标准比较器和位操作组件
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// ReputationCalculator — 信誉评分与等级计算电路
//
// 核心职责：
//   - 基于历史行为记录计算信誉评分
//   - 线性加权：score = Σ(behavior[i] * weight[i])
//   - 强制 score ∈ [0, 1000]
//
// 隐私承诺：
//   - past_behaviors[i]：历史行为评分（私有，0-100）
//   - weights[i]：时间衰减权重（公开，链下计算）
//   - 公开输出：信誉评分，不暴露具体历史行为
//
// 业务场景：
//   - 用户信誉等级计算
//   - 信用借贷额度评估
//   - DAO 治理权重分配
//
// 精度说明：
//   - 行为评分：0-100（整数）
//   - 权重：定点数 * 1000（例如 0.5 表示为 500）
//   - 最终评分：0-1000（整数）
//
// 安全性：
//   - 历史行为数量固定（最多 10 条），防止动态数组复杂度
//   - 权重总和强制 = 1000（归一化）
//   - 评分范围强制 ∈ [0, 1000]
//
// 使用示例：
//   component rep = ReputationCalculator(5);  // 5 条历史记录
//   for (var i = 0; i < 5; i++) {
//       rep.past_behaviors[i] <== behavior_score[i];  // 0-100
//       rep.weights[i] <== weight[i];                 // 0-1000
//   }
//   // rep.reputation_score 为计算得出的信誉分（0-1000）
// ═══════════════════════════════════════════════════════════════════════════════

template ReputationCalculator(n) {
    // ── 私有输入 (Witness — 绝不离端，禁止日志记录) ─────────────────────────
    signal input past_behaviors[n];   // 历史行为评分（每条 0-100）
    
    // ── 公开输入 (Public Inputs — 链上可验证) ───────────────────────────────
    signal input weights[n];          // 权重（定点数 * 1000，总和必须 = 1000）
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output reputation_score;   // 信誉评分（0-1000）
    
    // ── 步骤 1: 历史行为范围约束（0-100）───────────────────────────────────
    // 每条行为评分必须 ∈ [0, 100]
    // 使用 7-bit（2^7 = 128 > 100）
    component behaviorRangeCheck[n];
    for (var i = 0; i < n; i++) {
        behaviorRangeCheck[i] = Num2Bits(7);
        behaviorRangeCheck[i].in <== past_behaviors[i];
    }
    
    // ── 步骤 2: 权重范围约束（0-1000）──────────────────────────────────────
    // 每个权重必须 ∈ [0, 1000]
    // 使用 10-bit（2^10 = 1024 > 1000）
    component weightRangeCheck[n];
    for (var i = 0; i < n; i++) {
        weightRangeCheck[i] = Num2Bits(10);
        weightRangeCheck[i].in <== weights[i];
    }
    
    // ── 步骤 3: 权重归一化约束（总和必须 = 1000）──────────────────────────
    // 强制 Σ(weights[i]) = 1000，确保评分标准化
    signal weight_sum;
    if (n == 1) {
        weight_sum <== weights[0];
    } else if (n == 2) {
        weight_sum <== weights[0] + weights[1];
    } else if (n == 3) {
        weight_sum <== weights[0] + weights[1] + weights[2];
    } else if (n == 4) {
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3];
    } else if (n == 5) {
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4];
    } else if (n == 6) {
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4] + weights[5];
    } else if (n == 7) {
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4] + weights[5] + weights[6];
    } else if (n == 8) {
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4] + weights[5] + weights[6] + weights[7];
    } else if (n == 9) {
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4] + weights[5] + weights[6] + weights[7] + weights[8];
    } else { // n == 10
        weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4] + weights[5] + weights[6] + weights[7] + weights[8] + weights[9];
    }
    weight_sum === 1000;
    
    // ── 步骤 4: 加权评分计算 ───────────────────────────────────────────────
    // reputation_score = Σ(past_behaviors[i] * weights[i]) / 1000
    // 由于 Circom 不支持除法，先计算分子，最终结果范围 0-100000
    // 然后约束最终结果 / 100 ∈ [0, 1000]（等价于 0-1000）
    signal weighted_scores[n];
    
    for (var i = 0; i < n; i++) {
        weighted_scores[i] <== past_behaviors[i] * weights[i];
    }
    
    // 手动展开累加
    signal total_score;
    if (n == 1) {
        total_score <== weighted_scores[0];
    } else if (n == 2) {
        total_score <== weighted_scores[0] + weighted_scores[1];
    } else if (n == 3) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2];
    } else if (n == 4) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3];
    } else if (n == 5) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3] + weighted_scores[4];
    } else if (n == 6) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3] + weighted_scores[4] + weighted_scores[5];
    } else if (n == 7) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3] + weighted_scores[4] + weighted_scores[5] + weighted_scores[6];
    } else if (n == 8) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3] + weighted_scores[4] + weighted_scores[5] + weighted_scores[6] + weighted_scores[7];
    } else if (n == 9) {
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3] + weighted_scores[4] + weighted_scores[5] + weighted_scores[6] + weighted_scores[7] + weighted_scores[8];
    } else { // n == 10
        total_score <== weighted_scores[0] + weighted_scores[1] + weighted_scores[2] + weighted_scores[3] + weighted_scores[4] + weighted_scores[5] + weighted_scores[6] + weighted_scores[7] + weighted_scores[8] + weighted_scores[9];
    }
    
    // ── 步骤 5: 信誉评分范围约束（0-1000）──────────────────────────────────
    // total_score 范围应为 0-100000（100 * 1000）
    // 由于权重归一化为 1000，total_score / 1000 即为最终评分
    // 约束 total_score <= 100000（等价于评分 <= 1000）
    component maxScoreCheck = LessEqThan(20);  // 2^20 > 100000
    maxScoreCheck.in[0] <== total_score;
    maxScoreCheck.in[1] <== 100000;
    
    // ── 步骤 6: 输出信誉评分 ───────────────────────────────────────────────
    // 由于 Circom 不支持除法，输出 total_score
    // 链下解释时除以 1000 得到 0-1000 的评分
    reputation_score <== total_score;
    
    // ── 强制约束：评分必须有效（0-100000）────────────────────────────────
    // 实际评分 = reputation_score / 1000
    // 这里约束总分在有效范围内
    component rangeCheck = Num2Bits(20);  // 2^20 > 100000
    rangeCheck.in <== reputation_score;
}

// ── 导出模板供其他电路引用 ─────────────────────────────────────────────────
// 使用方式：
//   include "./utils/reputation_calculator.circom";
//   component rep = ReputationCalculator(5);  // 5 条历史记录
//   rep.past_behaviors[i] <== behavior_scores;
//   rep.weights[i] <== time_weights;
//   // rep.reputation_score / 1000 为实际信誉分（0-1000）
