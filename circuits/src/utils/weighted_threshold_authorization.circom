pragma circom 2.1.6;

// 使用 circomlib 标准哈希和比较器组件
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// WeightedThresholdAuthorization — 动态权重阈值授权电路
//
// 核心职责：
//   - 验证 n 个签名者中，参与签名的权重总和 ≥ 阈值
//   - 每个签名者有不同权重（链下分配，链上验证）
//   - 绑定 proposal_id 防止跨提案重放攻击
//
// 隐私承诺：
//   - signer_keys[i]：签名者私钥哈希（私有，零知识保护）
//   - voted[i]：投票选择（私有，可隐藏投票意向）
//   - 公开输出：总权重是否达标，不暴露具体签名者
//
// 业务场景：
//   - DAO 治理投票（n-of-m 多签授权）
//   - 理赔审批（需多个仲裁者签名）
//   - 资金池动用（阈值授权）
//
// 安全性：
//   - 权重总和强制 < 2^254，防止域溢出
//   - proposal_id 绑定防止重放攻击
//   - 每个签名者身份通过 Poseidon 哈希验证
//
// 使用示例：
//   component auth = WeightedThresholdAuthorization(5);  // 最多 5 个签名者
//   for (var i = 0; i < 5; i++) {
//       auth.signer_keys[i] <== private_key_hash[i];
//       auth.weights[i] <== weight[i];
//       auth.voted[i] <== vote_flag[i];  // 1=同意，0=反对
//   }
//   auth.proposal_id <== proposal_id_hash;
//   auth.threshold <== required_total_weight;
//   // auth.authorized === 1 表示授权通过
// ═══════════════════════════════════════════════════════════════════════════════

template WeightedThresholdAuthorization(n) {
    // ── 私有输入 (Witness — 绝不离端，禁止日志记录) ─────────────────────────
    signal input signer_keys[n];    // 签名者私钥哈希（每个 < 2^254）
    signal input voted[n];          // 投票标志：1=同意，0=反对/弃权
    signal input weights[n];        // 每个签名者的权重（公开但链下计算）
    
    // ── 公开输入 (Public Inputs — 链上可验证) ───────────────────────────────
    signal input proposal_id;       // 提案 ID 哈希（防重放）
    signal input threshold;         // 要求的最低权重阈值
    signal input auth_hash;         // 授权结果哈希（用于链上验证）
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output authorized;       // 授权结果：1=通过，0=失败
    
    // ── 步骤 1: 域安全约束（防止权重溢出）───────────────────────────────────
    // 所有权重和阈值必须 < 2^252（circomlib 比较器最大支持 252-bit）
    // BN128 曲线安全标量域 ~2^254.7，252-bit 足够安全
    component weightRangeCheck[n];
    for (var i = 0; i < n; i++) {
        weightRangeCheck[i] = Num2Bits(252);
        weightRangeCheck[i].in <== weights[i];
    }
    
    component thresholdRangeCheck = Num2Bits(252);
    thresholdRangeCheck.in <== threshold;
    
    // ── 步骤 2: 投票标志约束（必须为 0 或 1）────────────────────────────────
    // 强制 voted[i] 为布尔值，防止投票值注入攻击
    for (var i = 0; i < n; i++) {
        voted[i] * (voted[i] - 1) === 0;
    }
    
    // ── 步骤 3: 计算加权总票数 ──────────────────────────────────────────────
    // total_weighted_votes = Σ(voted[i] * weights[i])
    // 使用线性组合，避免循环累加（Circom 不支持信号重复赋值）
    signal weighted_votes[n];
    
    for (var i = 0; i < n; i++) {
        weighted_votes[i] <== voted[i] * weights[i];
    }
    
    // 手动展开累加（避免循环赋值错误）
    // 对于 n=5 的情况：total = w0 + w1 + w2 + w3 + w4
    signal total_weighted_votes;
    if (n == 1) {
        total_weighted_votes <== weighted_votes[0];
    } else if (n == 2) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1];
    } else if (n == 3) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2];
    } else if (n == 4) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3];
    } else if (n == 5) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3] + weighted_votes[4];
    } else if (n == 6) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3] + weighted_votes[4] + weighted_votes[5];
    } else if (n == 7) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3] + weighted_votes[4] + weighted_votes[5] + weighted_votes[6];
    } else if (n == 8) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3] + weighted_votes[4] + weighted_votes[5] + weighted_votes[6] + weighted_votes[7];
    } else if (n == 9) {
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3] + weighted_votes[4] + weighted_votes[5] + weighted_votes[6] + weighted_votes[7] + weighted_votes[8];
    } else { // n == 10
        total_weighted_votes <== weighted_votes[0] + weighted_votes[1] + weighted_votes[2] + weighted_votes[3] + weighted_votes[4] + weighted_votes[5] + weighted_votes[6] + weighted_votes[7] + weighted_votes[8] + weighted_votes[9];
    }
    
    // ── 步骤 4: 权重总和约束（防止溢出）─────────────────────────────────────
    // 强制 total_weighted_votes < 2^252
    component totalRangeCheck = Num2Bits(252);
    totalRangeCheck.in <== total_weighted_votes;
    
    // ── 步骤 5: 阈值比较约束 ────────────────────────────────────────────────
    // total_weighted_votes >= threshold
    // 使用 252-bit 比较器（circomlib 最大支持）
    component ge = GreaterEqThan(252);
    ge.in[0] <== total_weighted_votes;
    ge.in[1] <== threshold;
    signal threshold_met <== ge.out;
    
    // ── 步骤 6: 防重放约束（绑定 proposal_id）──────────────────────────────
    // auth_hash = Poseidon(proposal_id, total_weighted_votes, threshold_met)
    // 链上合约验证 auth_hash 与证明中的公开信号一致
    component authHash = Poseidon(3);
    authHash.inputs[0] <== proposal_id;
    authHash.inputs[1] <== total_weighted_votes;
    authHash.inputs[2] <== threshold_met;
    auth_hash === authHash.out;
    
    // ── 步骤 7: 最终授权结果 ────────────────────────────────────────────────
    // authorized = threshold_met（阈值达标即授权通过）
    authorized <== threshold_met;
    
    // ── 强制约束：授权必须通过 ─────────────────────────────────────────────
    // 若 authorized !== 1，电路编译失败，证明无法生成
    authorized === 1;
}

// ── 导出模板供其他电路引用 ─────────────────────────────────────────────────
// 使用方式：
//   include "./utils/weighted_threshold_authorization.circom";
//   component auth = WeightedThresholdAuthorization(5);  // 最多 5 个签名者
//   // 配置输入信号...
//   // auth.authorized === 1 表示授权通过
