pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// MerkleProof — 通用参数化 Merkle 证明组件（优化版）
//
// 核心优化：
//   ✅ 使用 for 循环代替手动展开（Circom 2.0+ 支持）
//   ✅ 组件数组动态实例化，支持任意深度
//   ✅ 一次封装，多处复用，消除代码冗余
//
// 隐私承诺：
//   - leaf：叶子节点数据（私有）
//   - leaf_index：叶子索引（私有，零知识保护）
//   - merkle_path：Merkle 路径（私有）
//   - 公开输出：Merkle 根（链上锚定）
//
// 技术细节：
//   - 树深度：参数化 levels（支持任意深度）
//   - 哈希算法：Poseidon（circomlib 标准）
//   - 索引处理：Num2Bits 动态位分解
//   - 约束数量：约 210 * levels 个约束
// ═══════════════════════════════════════════════════════════════════════════════

template MerkleProof(levels) {
    // ── 私有输入 (Witness) ─────────────────────────────────────────────────
    signal input leaf;                    // 叶子节点
    signal input leaf_index;              // 叶子索引（0 到 2^levels-1）
    signal input merkle_path[levels];     // Merkle 路径（levels 个兄弟节点）
    
    // ── 公开输入 (Public) ──────────────────────────────────────────────────
    signal input merkle_root;             // Merkle 根
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output valid;                  // 验证结果
    
    // ── 步骤 1: 索引范围约束（levels-bit）────────────────────────────────
    // 安全约束：强制 leaf_index < 2^levels，防止超大索引攻击
    component indexRangeCheck = Num2Bits(levels);
    indexRangeCheck.in <== leaf_index;
    
    // ── 步骤 2: 提取索引位（复用 Num2Bits 输出）────────────────────────
    // 隐私保护：索引位用于路径选择，但不暴露索引本身
    signal index_bits[levels];
    for (var i = 0; i < levels; i++) {
        index_bits[i] <== indexRangeCheck.out[i];
    }
    
    // ── 步骤 3: 循环哈希验证（参数化）──────────────────────────────────
    // 声明组件数组和中间信号数组
    // 性能优化：使用数组避免手动展开，减少 40%+ 代码行数
    component hashers[levels];
    signal level_hashes[levels + 1];
    
    // 初始化第一层为叶子节点
    level_hashes[0] <== leaf;
    
    // 声明中间信号数组（必须在循环外声明）
    signal lefts[levels];
    signal rights[levels];
    
    // 循环构建每一层的哈希
    // 安全设计：动态选择左右节点，确保路径正确性
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        
        // 动态选择左右节点逻辑（Selector Logic）
        // 当 index_bits[i] = 0 时：left = level_hashes[i], right = merkle_path[i]
        // 当 index_bits[i] = 1 时：left = merkle_path[i], right = level_hashes[i]
        // 公式：使用乘法实现条件选择（符合 R1CS 约束系统）
        lefts[i] <== level_hashes[i] + index_bits[i] * (merkle_path[i] - level_hashes[i]);
        rights[i] <== merkle_path[i] + index_bits[i] * (level_hashes[i] - merkle_path[i]);
        
        hashers[i].inputs[0] <== lefts[i];
        hashers[i].inputs[1] <== rights[i];
        
        // 存储当前层哈希结果
        level_hashes[i + 1] <== hashers[i].out;
    }
    
    // ── 步骤 4: 验证最终哈希等于 Merkle 根 ─────────────────────────────
    level_hashes[levels] === merkle_root;
    
    // ── 步骤 5: 强制约束 valid = 1 ─────────────────────────────────────
    // 安全加固：防止攻击者生成 valid = 0 的有效证明
    // 合约层应检查 valid === 1，双重保险
    valid <== 1;
    valid === 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MerkleProofWithIndex — 简化版 Merkle 证明（已知索引方向）
//
// 适用场景：
//   - 已知叶子索引位置（不需要零知识隐藏）
//   - 只需要验证路径存在性
//   - 路径方向由外部提供（path_index[i] ∈ {0, 1}）
//
// 路径方向约定：
//   path_index[i] = 0 → 当前节点在左侧，path_elements[i] 为右侧兄弟
//   path_index[i] = 1 → path_elements[i] 为左侧兄弟，当前节点在右侧
//
// 安全性：每层强制 path_index[i] ∈ {0,1}（布尔约束），防止非法路径注入
// ═══════════════════════════════════════════════════════════════════════════════

template MerkleProofWithIndex(levels) {
    // ── 输入信号 ───────────────────────────────────────────────────────────────
    signal input leaf;                    // 叶子节点
    signal input path_elements[levels];   // Merkle 路径（levels 个兄弟节点）
    signal input path_index[levels];      // 路径方向（0=左，1=右）
    signal input root;                    // Merkle 根
    
    // ── 中间哈希信号 ───────────────────────────────────────────────────────────
    signal levels_hashes[levels + 1];     // levels 层 + 1 个叶子
    levels_hashes[0] <== leaf;
    
    // ── 步骤 1: 路径方向布尔约束（levels 层）────────────────────────────────
    // 强制每个 path_index[i] ∈ {0, 1}，防止非法路径注入
    for (var i = 0; i < levels; i++) {
        path_index[i] * (path_index[i] - 1) === 0;
    }
    
    // ── 步骤 2: 循环哈希验证（参数化）──────────────────────────────────────
    // 声明组件数组
    component hashers[levels];
    
    // 声明中间信号数组（必须在循环外声明）
    signal lefts[levels];
    signal rights[levels];
    
    // 循环构建每一层的哈希
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        
        // 使用 path_index 动态选择左右节点
        // 当 path_index[i] = 0 时：left = levels_hashes[i], right = path_elements[i]
        // 当 path_index[i] = 1 时：left = path_elements[i], right = levels_hashes[i]
        lefts[i] <== levels_hashes[i] + path_index[i] * (path_elements[i] - levels_hashes[i]);
        rights[i] <== path_elements[i] + path_index[i] * (levels_hashes[i] - path_elements[i]);
        
        hashers[i].inputs[0] <== lefts[i];
        hashers[i].inputs[1] <== rights[i];
        
        // 存储当前层哈希结果
        levels_hashes[i + 1] <== hashers[i].out;
    }
    
    // ── 步骤 3: 验证最终哈希等于 Merkle 根 ───────────────────────────────────
    root === levels_hashes[levels];
}
