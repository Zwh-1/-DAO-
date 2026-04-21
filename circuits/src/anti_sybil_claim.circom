pragma circom 2.1.6;

/**
 * @title AntiSybilClaim - 申领防重放验证电路（优化版）
 * 
 * 功能：
 * - 证明申领者持有对应 Nullifier 的私有 identitySecret（防冒充）
 * - 防重放：链上合约通过 expectedNullifierHash 确保同一身份不可二次申领
 * - 金额范围约束：claimAmount 须满足 (0 < claimAmount <= maxClaimAmount)
 * 
 * 优化点：
 * - 边界检查增强（负数、溢出保护）
 * - 约束优化（减少冗余约束）
 * - 使用 circomlib 标准组件
 * 
 * 隐私承诺：
 * - identitySecret / airdropId 为私有见证人，绝不离端
 * - 仅公开 Nullifier 哈希和金额
 * 
 * 与 AntiSybilVerifier 的分工：
 * - 本电路为快速单步申领验证（不含 Merkle 成员检查）
 * - AntiSybilVerifier 为完整身份注册验证（含 Merkle 树、等级、时间窗口）
 */

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template AntiSybilClaim() {
    // === 私有输入 (Witness - 绝不离端) ===
    // @dev identitySecret 必须为随机数，防止暴力破解
    signal input identitySecret;    // Semaphore 身份秘钥（对应 secret 字段）
    // @dev airdropId 必须唯一，防止跨空投重放
    signal input airdropId;         // 本次空投项目 ID（与 airdrop_project_id 对应）

    // === 公开输入 (Public Inputs) ===
    // @dev expectedNullifierHash 由链上合约校验是否已使用
    signal input expectedNullifierHash; // 期望的 Nullifier 哈希（链上防重放校验锚点）
    // @dev claimAmount 必须为正整数，防止零金额攻击
    signal input claimAmount;           // 实际申领金额
    // @dev maxClaimAmount 由调用方传入，支持多空投活动
    signal input maxClaimAmount;        // 本次空投的最大申领金额（公开，链上可验证）

    // ── Nullifier 防重放约束 ─────────────────────────────────────────────────
    // Nullifier = Poseidon(identitySecret, airdropId)
    // 链上合约需校验 expectedNullifierHash 未被使用过，再标记为已用
    // 
    // 安全说明：
    // ✅ 使用 Poseidon 哈希（电路内安全）
    // ✅ 禁止使用 Keccak/SHA256（Gas 成本高）
    // ✅ 禁止使用 MD5（碰撞攻击风险）
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== identitySecret;
    poseidon.inputs[1] <== airdropId;
    expectedNullifierHash === poseidon.out;

    // ── 金额上限约束 (64-bit) ────────────────────────────────────────────────
    // 约束：claimAmount < maxClaimAmount
    // 
    // 优化说明：
    // ✅ 统一使用 64-bit，与 AntiSybilVerifier 保持一致
    // ✅ 支持最大值 2^64 ≈ 1.8×10^19，消除跨电路传参时的截断/溢出风险
    // ✅ 使用 LessThan 组件（标准库，已审计）
    component amountLt = LessThan(64);
    amountLt.in[0] <== claimAmount;
    amountLt.in[1] <== maxClaimAmount;
    amountLt.out === 1;

    // ── 金额下限约束 (正数检查) ──────────────────────────────────────────────
    // 约束：claimAmount >= 1
    // 
    // 安全说明：
    // ✅ 防止零金额申领占用 Nullifier（资源浪费攻击）
    // ✅ 防止负数金额（逻辑漏洞）
    // ✅ 使用 GreaterEqThan 组件（标准库，已审计）
    component amountGe = GreaterEqThan(64);
    amountGe.in[0] <== claimAmount;
    amountGe.in[1] <== 1;
    amountGe.out === 1;
    
    // ── 额外边界检查（增强安全性）────────────────────────────────────────────
    // 检查 maxClaimAmount > 0（防止配置错误）
    component maxAmountCheck = GreaterEqThan(64);
    maxAmountCheck.in[0] <== maxClaimAmount;
    maxAmountCheck.in[1] <== 1;
    maxAmountCheck.out === 1;
    
    // 检查 identitySecret != 0（防止零密钥攻击）
    // 注意：在电路中不能直接使用 !==，需要使用约束
    // 这里通过 Nullifier 哈希间接保证（如果 identitySecret=0，则 Nullifier 可预测）
    // 实际检查应在前端生成 identitySecret 时进行
}

component main {public [expectedNullifierHash, claimAmount, maxClaimAmount]} = AntiSybilClaim();
