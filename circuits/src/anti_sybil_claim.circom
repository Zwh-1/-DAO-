pragma circom 2.1.6;

// 使用 circomlib 标准库
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

// AntiSybilClaim — 申领防重放验证电路（轻量版）
//
// 职责：
//   - 证明申领者持有对应 Nullifier 的私有 identitySecret（防冒充）
//   - 防重放：链上合约通过 expectedNullifierHash 确保同一身份不可二次申领
//   - 金额范围约束：claimAmount 须满足 (0 < claimAmount < maxClaimAmount)
//
// 与 AntiSybilVerifier 的分工：
//   - 本电路为快速单步申领验证（不含 Merkle 成员检查）
//   - AntiSybilVerifier 为完整身份注册验证（含 Merkle 树、等级、时间窗口）
//
// 隐私承诺：identitySecret / airdropId 为私有见证人，绝不离端

template AntiSybilClaim() {
    // === 私有输入 (Witness — 绝不离端) ===
    signal input identitySecret;    // Semaphore 身份秘钥（对应 secret 字段）
    signal input airdropId;         // 本次空投项目 ID（与 airdrop_project_id 对应）

    // === 公开输入 (Public Inputs) ===
    signal input expectedNullifierHash; // 期望的 Nullifier 哈希（链上防重放校验锚点）
    signal input claimAmount;           // 实际申领金额
    // [修复: 硬编码] 由调用方传入，使同一电路可服务于不同金额上限的空投活动
    signal input maxClaimAmount;        // 本次空投的最大申领金额（公开，链上可验证）

    // ── Nullifier 防重放约束 ─────────────────────────────────────────────────
    // Nullifier = Poseidon(identitySecret, airdropId)
    // 链上合约需校验 expectedNullifierHash 未被使用过，再标记为已用
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== identitySecret;
    poseidon.inputs[1] <== airdropId;
    expectedNullifierHash === poseidon.out;

    // ── 金额上限约束 (64-bit) ────────────────────────────────────────────────
    // [修复: 位宽不一致] 统一使用 64-bit，与 AntiSybilVerifier 保持一致，
    // 支持最大值 2^64 ≈ 1.8×10^19，消除跨电路传参时的截断/溢出风险
    component amountLt = LessThan(64);
    amountLt.in[0] <== claimAmount;
    amountLt.in[1] <== maxClaimAmount;
    amountLt.out === 1;

    // ── 金额下限约束 (正数检查) ──────────────────────────────────────────────
    // 确保 claimAmount >= 1，防止零金额申领占用 Nullifier
    component amountGe = GreaterEqThan(64);
    amountGe.in[0] <== claimAmount;
    amountGe.in[1] <== 1;
    amountGe.out === 1;
}

component main {public [expectedNullifierHash, claimAmount, maxClaimAmount]} = AntiSybilClaim();
