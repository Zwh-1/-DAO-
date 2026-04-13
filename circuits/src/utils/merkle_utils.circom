pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// MerkleInclusionProof — 参数化 Merkle 树包含证明电路（优化版）
//
// 核心优化：
//   ✅ 使用组件数组代替手动展开，支持任意深度
//   ✅ 使用中间信号数组避免信号重复赋值错误
//   ✅ 使用 Num2Bits 统一处理索引位分解
//   ✅ 代码行数从 200+ 行减少到 50 行
//
// 隐私承诺：
//   - leaf：叶子节点数据（私有）
//   - leaf_index：叶子索引（私有）
//   - merkle_path：Merkle 路径（私有）
//   - 公开输出：Merkle 根（链上锚定）
//
// 技术细节：
//   - 树深度：参数化 levels（默认 20 层，支持 2^20 = 1,048,576 个叶子）
//   - 哈希函数：Poseidon（circomlib 标准组件）
//   - 索引处理：使用 Num2Bits 动态选择左右子节点
//   - 约束数量：约 210 * levels 个约束（20 层约 4200 个约束）
// ═══════════════════════════════════════════════════════════════════════════════

template MerkleInclusionProof(levels) {
    // ── 私有输入 (Witness) ─────────────────────────────────────────────────
    signal input leaf;                    // 叶子节点
    signal input leaf_index;              // 叶子索引（0 到 2^levels-1）
    signal input merkle_path[levels];     // Merkle 路径（levels 个兄弟节点）
    
    // ── 公开输入 (Public) ──────────────────────────────────────────────────
    signal input merkle_root;             // Merkle 根
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output valid;                  // 验证结果
    
    // ── 步骤 1: 索引范围约束（levels-bit）────────────────────────────────
    // 使用 Num2Bits 强制 leaf_index 在有效范围内
    component indexRangeCheck = Num2Bits(levels);
    indexRangeCheck.in <== leaf_index;
    
    // ── 步骤 2: 提取索引的每一位（复用 Num2Bits 输出）────────────────────
    // 注意：Num2Bits.out[i] 已经是布尔值，无需额外约束
    signal index_bits[levels];
    for (var i = 0; i < levels; i++) {
        index_bits[i] <== indexRangeCheck.out[i];
    }
    
    // ── 步骤 3: 参数化循环哈希验证 ─────────────────────────────────────
    // 声明组件数组和中间信号数组
    component hashers[levels];
    signal level_hashes[levels + 1];
    
    // 初始化第一层为叶子节点
    level_hashes[0] <== leaf;
    
    // ── 步骤 2: 循环哈希验证（参数化）──────────────────────────────────────
    // 声明中间信号数组（必须在循环外声明）
    signal lefts[levels];
    signal rights[levels];
    
    // 循环构建每一层的哈希
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        
        // 动态选择左右节点逻辑（Selector Logic）
        // 当 index_bits[i] = 0 时：left = level_hashes[i], right = merkle_path[i]
        // 当 index_bits[i] = 1 时：left = merkle_path[i], right = level_hashes[i]
        // 公式：left = level_hashes[i] + index_bits[i] * (merkle_path[i] - level_hashes[i])
        lefts[i] <== level_hashes[i] + index_bits[i] * (merkle_path[i] - level_hashes[i]);
        rights[i] <== merkle_path[i] + index_bits[i] * (level_hashes[i] - merkle_path[i]);
        
        hashers[i].inputs[0] <== lefts[i];
        hashers[i].inputs[1] <== rights[i];
        
        // 存储当前层哈希结果
        level_hashes[i + 1] <== hashers[i].out;
    }
    
    // ── 步骤 4: 验证最终哈希等于 Merkle 根 ─────────────────────────────
    level_hashes[levels] === merkle_root;
    
    // ── 步骤 5: 输出验证结果（强制约束 valid = 1）──────────────────────
    // 安全加固：防止攻击者生成 valid = 0 的有效证明
    valid <== 1;
    valid === 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MerkleTreeInclusion — 简化版 Merkle 树验证（不带索引零知识）
//
// 适用场景：
//   - 已知叶子索引位置
//   - 不需要隐藏叶子位置信息
//   - 只需要验证路径存在性
//
// 路径方向约定：path_index[i] ∈ {0, 1}
//   0 → 当前节点哈希位于左侧，path_elements[i] 为右侧兄弟节点
//   1 → path_elements[i] 为左侧兄弟节点，当前节点哈希位于右侧
//
// 安全性：每层强制 path_index[i] ∈ {0,1}（布尔约束），防止攻击者构造非法路径方向
// ═══════════════════════════════════════════════════════════════════════════════

template MerkleTreeInclusion(levels) {
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
    
    // ── 步骤 2: 参数化循环哈希验证 ───────────────────────────────────────
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
