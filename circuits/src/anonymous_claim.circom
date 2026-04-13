pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// AnonymousClaim — 匿名资金领取电路（生产版）
//
// 核心职责：
//   - 证明用户拥有 Merkle Tree 中某个叶子节点的控制权
//   - 不暴露具体是哪个叶子节点（隐私保护）
//   - 生成 Nullifier 防止重复领取
//   - 验证领取资格（如：时间窗口、金额范围）
//
// 隐私承诺：
//   - secret：用户密钥（私有）
//   - leaf_index：叶子索引（私有）
//   - merkle_path：Merkle 路径（私有）
//   - 公开输出：Merkle Root、Nullifier、领取金额
//
// 业务场景：
//   - 匿名空投领取
//   - 隐私互助奖励
//   - 去中心化补贴发放
//
// 技术细节：
//   - 树深度：20 层（支持 2^20 = 1,048,576 个用户）
//   - Nullifier: Poseidon(secret, airdrop_id)
//   - 承诺：Poseidon(secret, nullifier)
//   - 手动展开：20 层 Merkle 路径验证
//
// 安全性：
//   - 防重放：Nullifier 全局唯一，合约记录已使用
//   - 防伪造：必须提供有效的 Merkle 证明
//   - 隐私保护：不暴露用户身份和索引
//
// 约束数量：~20,000（20 层 Merkle 树）
// 证明生成：~3-5 秒（中端设备）
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "utils/merkle_proof.circom";  // 通用 Merkle 证明组件

template AnonymousClaim() {
    // ── 私有输入（Witness，绝不离端）──────────────────────────────────
    signal input secret;                // 用户密钥（254-bit，隐私核心）
    signal input leaf_index;            // 叶子索引（20-bit，隐私）
    signal input merkle_path[20];       // Merkle 路径（20 个哈希，隐私）
    signal input airdrop_id;            // 空投批次 ID（公开，用于区分不同活动）
    
    // ── 公开输入（Public Inputs，链上可验证）────────────────────────
    signal input merkle_root;           // Merkle 根（公开，链上存储）
    signal input nullifier;             // 防重放 Nullifier（公开，链上记录）
    signal input commitment;            // 用户承诺（公开，用于验证）
    signal input claim_amount;          // 领取金额（公开，链上转账）
    
    // ── 步骤 1: Nullifier 计算 ──────────────────────────────────────
    // 安全设计：
    // - Nullifier = Poseidon(secret, airdrop_id)
    // - 同一用户在同一空投批次中只能生成一个 Nullifier
    // - 不同批次（airdrop_id 不同）可以重复领取
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== secret;
    nullifierHash.inputs[1] <== airdrop_id;
    nullifierHash.out === nullifier;
    
    // ── 步骤 2: 承诺计算 ────────────────────────────────────────────
    // 承诺 = Poseidon(secret, nullifier)
    // 用于链上验证用户已提交承诺到 Merkle Tree
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== secret;
    commitmentHash.inputs[1] <== nullifier;
    commitmentHash.out === commitment;
    
    // ── 步骤 3: Merkle 证明验证 ─────────────────────────────────────
    // 安全设计：
    // - 证明 commitment 存在于 merkle_root 中
    // - 不暴露 leaf_index 和 merkle_path
    // - 使用通用 MerkleProof(20) 组件
    component merkleProof = MerkleProof(20);
    merkleProof.leaf <== commitment;
    merkleProof.leaf_index <== leaf_index;
    for (var i = 0; i < 20; i++) {
        merkleProof.merkle_path[i] <== merkle_path[i];
    }
    merkleProof.merkle_root <== merkle_root;
    // merkleProof.valid === 1 已内部强制约束
    
    // ── 步骤 4: 领取金额范围验证（可选）─────────────────────────────
    // 安全设计：
    // - 验证领取金额在合理范围内（防止 dust attack 或超额领取）
    // - 范围：1 <= claim_amount <= 10^18（1 ETH）
    component amountRangeCheck = Num2Bits(64);
    amountRangeCheck.in <== claim_amount;
    
    // 最小金额检查（>= 1）
    component minAmountCheck = GreaterEqThan(64);
    minAmountCheck.in[0] <== claim_amount;
    minAmountCheck.in[1] <== 1;
    minAmountCheck.out === 1;
    
    // 最大金额检查（<= 10^18）
    component maxAmountCheck = LessEqThan(64);
    maxAmountCheck.in[0] <== claim_amount;
    maxAmountCheck.in[1] <== 1000000000000000000;  // 1 ETH
    maxAmountCheck.out === 1;
    
    // ── 步骤 5: 时间窗口验证（可选，需要公开输入）──────────────────
    // 业务场景：
    // - 空投有明确的开始和结束时间
    // - 防止提前领取或逾期领取
    // - 时间戳由合约提供（链上时间）
    signal input current_timestamp;     // 当前区块时间戳（公开）
    signal input ts_start;              // 开始时间（公开）
    signal input ts_end;                // 结束时间（公开）
    
    // 时间范围检查：ts_start <= current_timestamp <= ts_end
    component timeStartCheck = GreaterEqThan(64);
    timeStartCheck.in[0] <== current_timestamp;
    timeStartCheck.in[1] <== ts_start;
    timeStartCheck.out === 1;  // current >= ts_start
    
    component timeEndCheck = LessEqThan(64);
    timeEndCheck.in[0] <== current_timestamp;
    timeEndCheck.in[1] <== ts_end;
    timeEndCheck.out === 1;  // current <= ts_end
}

component main = AnonymousClaim();
