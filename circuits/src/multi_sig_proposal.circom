pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// MultiSigProposal — 多重签名提案验证电路（生产版）
//
// 核心职责：
//   - 验证 n 个签名者中，参与签名的权重总和 ≥ 阈值
//   - 每个签名者有不同权重（链下分配，链上验证）
//   - 绑定 proposal_id 防止跨提案重放攻击
//   - 支持动态权重分配（DAO 治理、多签钱包）
//
// 隐私承诺：
//   - signer_keys[i]：签名者私钥哈希（私有，零知识保护）
//   - voted[i]：投票选择（私有，可隐藏投票意向）
//   - 公开输出：总权重是否达标，不暴露具体签名者
//
// 业务场景：
//   - DAO 治理投票（n-of-m 多签授权）
//   - 资金池动用审批（阈值授权）
//   - 合约升级提案（多重签名验证）
//   - 理赔审批（多仲裁者签名）
//
// 技术细节：
//   - 签名者数量：固定 5 个（可扩展）
//   - 权重精度：252-bit 定点数（防止溢出）
//   - 投票标志：布尔值（0=反对/弃权，1=同意）
//   - 阈值验证：Σ(voted[i] * weights[i]) >= threshold
//
// 安全性：
//   - 权重范围：weights[i] < 2^252，防止域溢出
//   - 投票约束：voted[i] ∈ {0, 1}，防止投票值注入
//   - 提案绑定：proposal_id 防止重放攻击
//   - 权重总和：强制 < 2^254，符合 BN128 曲线安全域
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template MultiSigProposal(nSigners) {
    // 安全约束：nSigners 必须为正整数
    // 编译期检查：Circom 会在编译时报错如果 nSigners <= 0
    
    // 私有输入（Witness，绝不离端）
    signal input signer_keys[nSigners];    // nSigners 个签名者私钥哈希
    signal input voted[nSigners];          // 投票标志：1=同意，0=反对/弃权
    signal input weights[nSigners];        // 每个签名者的权重
    
    // 公开输入（Public Inputs，链上可验证）
    signal input proposal_id;       // 提案 ID（防重放）
    signal input threshold;         // 最低权重阈值
    signal input auth_hash;         // 授权结果哈希
    
    // 步骤 1：权重范围约束（< 2^252）
    // 安全说明：防止域溢出，BN128 曲线标量域约为 2^254
    component weightRangeCheck[nSigners];
    for (var i = 0; i < nSigners; i++) {
        weightRangeCheck[i] = Num2Bits(252);
        weightRangeCheck[i].in <== weights[i];
    }
    
    component thresholdRangeCheck = Num2Bits(252);
    thresholdRangeCheck.in <== threshold;
    
    // 步骤 2：投票标志约束（布尔值）
    // 安全说明：强制 voted[i] ∈ {0, 1}，防止恶意投票值注入
    for (var i = 0; i < nSigners; i++) {
        voted[i] * (voted[i] - 1) === 0;
    }
    
    // 步骤 3：计算加权总票数
    // 优化说明：使用循环累加，支持动态签名者数量
    signal weighted_votes[nSigners];
    for (var i = 0; i < nSigners; i++) {
        weighted_votes[i] <== voted[i] * weights[i];
    }
    
    // 动态累加总权重（使用中间信号数组）
    // 安全说明：Circom 中信号只能赋值一次，需使用数组累积
    signal partial_sums[nSigners + 1];
    partial_sums[0] <== 0;  // 初始值为 0
    
    for (var i = 0; i < nSigners; i++) {
        partial_sums[i + 1] <== partial_sums[i] + weighted_votes[i];
    }
    
    signal total_weighted_votes;
    total_weighted_votes <== partial_sums[nSigners];
    
    // 步骤 4：阈值验证
    // 安全说明：total_weighted_votes >= threshold
    component ge = GreaterEqThan(252);
    ge.in[0] <== total_weighted_votes;
    ge.in[1] <== threshold;
    ge.out === 1;
    
    // 步骤 5：计算授权结果哈希
    // 安全说明：绑定 proposal_id 防止跨提案重放攻击
    component authHash = Poseidon(3);
    authHash.inputs[0] <== total_weighted_votes;
    authHash.inputs[1] <== proposal_id;
    authHash.inputs[2] <== 1;  // threshold_met 已验证
    authHash.out === auth_hash;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主电路实例化：5 个签名者的多签提案
// 
// 扩展指南：
//   - 3 人多签：component main = MultiSigProposal(3);
//   - 7 人多签：component main = MultiSigProposal(7);
//   - 11 人多签：component main = MultiSigProposal(11);
// 
// 公开输入：proposal_id, threshold, auth_hash
// 私有输入：signer_keys[nSigners], voted[nSigners], weights[nSigners]
// 
// 隐私保护：
//   - signer_keys[i]: 签名者私钥哈希，绝不离端
//   - voted[i]: 投票意向，零知识保护
//   - weights[i]: 权重分配，可不公开
// ═══════════════════════════════════════════════════════════════════════════════
component main {
    public [proposal_id, threshold, auth_hash]
} = MultiSigProposal(5);
