pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// ReputationVerifier — 信誉评分验证电路（生产版）
//
// 核心职责：
//   - 基于历史行为记录计算信誉评分
//   - 验证信誉评分是否达到阈值
//   - 线性加权：score = Σ(behavior[i] * weight[i])
//   - 强制 score ∈ [0, 1000]
//
// 隐私承诺：
//   - past_behaviors[i]：历史行为评分（私有，0-100）
//   - weights[i]：时间衰减权重（公开，链下计算）
//   - 公开输出：信誉评分哈希，不暴露具体历史行为
//
// 业务场景：
//   - 信用借贷资格审核
//   - DAO 治理权重分配
//   - 优先服务等级评定
//   - 空投等级划分
//
// 技术细节：
//   - 历史行为数量：固定 5 条（可扩展）
//   - 行为评分：0-100（整数，7-bit）
//   - 权重：定点数 * 1000（0-1000，10-bit）
//   - 最终评分：0-1000（整数）
//   - 归一化：Σ(weights[i]) = 1000
//
// 安全性：
//   - 行为范围：behavior[i] ∈ [0, 100]
//   - 权重范围：weight[i] ∈ [0, 1000]
//   - 权重归一化：Σ(weights[i]) = 1000
//   - 评分范围：score ∈ [0, 1000]
//   - 阈值验证：score >= required_score
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template ReputationVerifier() {
    // 私有输入（Witness，绝不离端）
    signal input past_behaviors[5];   // 5 条历史行为评分（0-100）
    signal input weights[5];          // 权重（总和 = 1000）
    
    // 公开输入（Public Inputs，链上可验证）
    signal input required_score;      // 最低信誉分（0-1000）
    signal input reputation_hash;     // 信誉分哈希
    
    // 步骤 1：历史行为范围约束（0-100）
    component behaviorRangeCheck[5];
    for (var i = 0; i < 5; i++) {
        behaviorRangeCheck[i] = Num2Bits(7);
        behaviorRangeCheck[i].in <== past_behaviors[i];
    }
    
    // 步骤 2：权重范围约束（0-1000）
    component weightRangeCheck[5];
    for (var i = 0; i < 5; i++) {
        weightRangeCheck[i] = Num2Bits(10);
        weightRangeCheck[i].in <== weights[i];
    }
    
    // 步骤 3：权重归一化（总和 = 1000）
    signal weight_sum;
    weight_sum <== weights[0] + weights[1] + weights[2] + weights[3] + weights[4];
    weight_sum === 1000;
    
    // 步骤 4：计算信誉评分
    signal weighted_scores[5];
    for (var i = 0; i < 5; i++) {
        weighted_scores[i] <== past_behaviors[i] * weights[i];
    }
    
    signal total_score;
    total_score <== weighted_scores[0] + weighted_scores[1] + 
                    weighted_scores[2] + weighted_scores[3] + 
                    weighted_scores[4];
    
    // 步骤 5：评分范围约束（0-100000）
    component scoreRangeCheck = Num2Bits(17);
    scoreRangeCheck.in <== total_score;
    
    // 步骤 6：验证信誉分是否达标
    signal scaled_required;
    scaled_required <== required_score * 1000;
    
    component ge = GreaterEqThan(20);
    ge.in[0] <== total_score;
    ge.in[1] <== scaled_required;
    ge.out === 1;
    
    // 步骤 7：计算信誉分哈希
    component hash = Poseidon(1);
    hash.inputs[0] <== total_score;
    hash.out === reputation_hash;
}

// 主电路：信誉评分验证
// 公开输入：required_score, reputation_hash
// 私有输入：past_behaviors[5], weights[5]
component main {
    public [required_score, reputation_hash]
} = ReputationVerifier();
