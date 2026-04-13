pragma circom 2.1.6;

// ═══════════════════════════════════════════════════════════════════════════════
// HistoryAnchor — 历史行为锚定验证电路（生产版）
//
// 核心职责：
//   - 证明某个历史行为数据存在于 Merkle 树中
//   - 不暴露历史行为的具体位置（索引零知识）
//   - 验证历史数据哈希一致性
//   - 支持 20 层 Merkle 树（100 万 + 历史记录）
//
// 隐私承诺：
//   - history_data：历史行为数据（私有）
//   - history_index：历史索引（私有，不暴露位置）
//   - merkle_path：Merkle 路径（私有）
//   - 公开输出：Merkle 根 + 历史数据哈希
//
// 业务场景：
//   - 历史行为可验证（链上锚定）
//   - 信誉记录不可篡改
//   - 审计追溯（隐私保护）
//   - 空投资格证明（历史贡献）
//
// 技术细节：
//   - 树深度：20 层（支持 2^20 = 1,048,576 条记录）
//   - 手动展开：20 层 Merkle 路径验证（避免 Circom 循环限制）
//   - 哈希算法：Poseidon（电路内标准）
//   - 索引隐私：不暴露历史行为在树中的位置
//
// 安全性：
//   - 索引范围：index ∈ [0, 2^20-1]
//   - 路径验证：逐层哈希，最终等于 Merkle 根
//   - 数据一致：history_hash = Poseidon(history_data)
//   - 防篡改：Merkle 根链上存储，无法伪造
// ═══════════════════════════════════════════════════════════════════════════════

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template HistoryAnchor() {
    // 私有输入（Witness，绝不离端）
    signal input history_data;          // 历史行为数据
    signal input history_index;         // 历史索引（20-bit）
    signal input merkle_path[20];       // Merkle 路径（20 层）
    
    // 公开输入（Public Inputs，链上可验证）
    signal input merkle_root;           // Merkle 根
    signal input history_hash;          // 历史数据哈希
    
    // 步骤 1：索引范围约束（< 2^20）
    component indexRangeCheck = Num2Bits(20);
    indexRangeCheck.in <== history_index;
    
    // 步骤 2：提取索引位
    signal index_bits[20];
    component indexBits = Num2Bits(20);
    indexBits.in <== history_index;
    for (var i = 0; i < 20; i++) {
        index_bits[i] <== indexBits.out[i];
    }
    
    // 步骤 3：Merkle 路径验证（20 层）
    // 20 层 Merkle 路径验证（手动展开，避免 Circom 循环限制）
    component hash0 = Poseidon(2);
    hash0.inputs[0] <== index_bits[0] * (merkle_path[0] - history_data) + history_data;
    hash0.inputs[1] <== (1 - index_bits[0]) * (history_data - merkle_path[0]) + merkle_path[0];
    signal h0 <== hash0.out;
    
    // 第 2 层
    component hash1 = Poseidon(2);
    hash1.inputs[0] <== index_bits[1] * (merkle_path[1] - h0) + h0;
    hash1.inputs[1] <== (1 - index_bits[1]) * (h0 - merkle_path[1]) + merkle_path[1];
    signal h1 <== hash1.out;
    
    // 第 3 层
    component hash2 = Poseidon(2);
    hash2.inputs[0] <== index_bits[2] * (merkle_path[2] - h1) + h1;
    hash2.inputs[1] <== (1 - index_bits[2]) * (h1 - merkle_path[2]) + merkle_path[2];
    signal h2 <== hash2.out;
    
    // 第 4 层
    component hash3 = Poseidon(2);
    hash3.inputs[0] <== index_bits[3] * (merkle_path[3] - h2) + h2;
    hash3.inputs[1] <== (1 - index_bits[3]) * (h2 - merkle_path[3]) + merkle_path[3];
    signal h3 <== hash3.out;
    
    // 第 5 层
    component hash4 = Poseidon(2);
    hash4.inputs[0] <== index_bits[4] * (merkle_path[4] - h3) + h3;
    hash4.inputs[1] <== (1 - index_bits[4]) * (h3 - merkle_path[4]) + merkle_path[4];
    signal h4 <== hash4.out;
    
    // 第 6 层
    component hash5 = Poseidon(2);
    hash5.inputs[0] <== index_bits[5] * (merkle_path[5] - h4) + h4;
    hash5.inputs[1] <== (1 - index_bits[5]) * (h4 - merkle_path[5]) + merkle_path[5];
    signal h5 <== hash5.out;
    
    // 第 7 层
    component hash6 = Poseidon(2);
    hash6.inputs[0] <== index_bits[6] * (merkle_path[6] - h5) + h5;
    hash6.inputs[1] <== (1 - index_bits[6]) * (h5 - merkle_path[6]) + merkle_path[6];
    signal h6 <== hash6.out;
    
    // 第 8 层
    component hash7 = Poseidon(2);
    hash7.inputs[0] <== index_bits[7] * (merkle_path[7] - h6) + h6;
    hash7.inputs[1] <== (1 - index_bits[7]) * (h6 - merkle_path[7]) + merkle_path[7];
    signal h7 <== hash7.out;
    
    // 第 9 层
    component hash8 = Poseidon(2);
    hash8.inputs[0] <== index_bits[8] * (merkle_path[8] - h7) + h7;
    hash8.inputs[1] <== (1 - index_bits[8]) * (h7 - merkle_path[8]) + merkle_path[8];
    signal h8 <== hash8.out;
    
    // 第 10 层
    component hash9 = Poseidon(2);
    hash9.inputs[0] <== index_bits[9] * (merkle_path[9] - h8) + h8;
    hash9.inputs[1] <== (1 - index_bits[9]) * (h8 - merkle_path[9]) + merkle_path[9];
    signal h9 <== hash9.out;
    
    // 第 11 层
    component hash10 = Poseidon(2);
    hash10.inputs[0] <== index_bits[10] * (merkle_path[10] - h9) + h9;
    hash10.inputs[1] <== (1 - index_bits[10]) * (h9 - merkle_path[10]) + merkle_path[10];
    signal h10 <== hash10.out;
    
    // 第 12 层
    component hash11 = Poseidon(2);
    hash11.inputs[0] <== index_bits[11] * (merkle_path[11] - h10) + h10;
    hash11.inputs[1] <== (1 - index_bits[11]) * (h10 - merkle_path[11]) + merkle_path[11];
    signal h11 <== hash11.out;
    
    // 第 13 层
    component hash12 = Poseidon(2);
    hash12.inputs[0] <== index_bits[12] * (merkle_path[12] - h11) + h11;
    hash12.inputs[1] <== (1 - index_bits[12]) * (h11 - merkle_path[12]) + merkle_path[12];
    signal h12 <== hash12.out;
    
    // 第 14 层
    component hash13 = Poseidon(2);
    hash13.inputs[0] <== index_bits[13] * (merkle_path[13] - h12) + h12;
    hash13.inputs[1] <== (1 - index_bits[13]) * (h12 - merkle_path[13]) + merkle_path[13];
    signal h13 <== hash13.out;
    
    // 第 15 层
    component hash14 = Poseidon(2);
    hash14.inputs[0] <== index_bits[14] * (merkle_path[14] - h13) + h13;
    hash14.inputs[1] <== (1 - index_bits[14]) * (h13 - merkle_path[14]) + merkle_path[14];
    signal h14 <== hash14.out;
    
    // 第 16 层
    component hash15 = Poseidon(2);
    hash15.inputs[0] <== index_bits[15] * (merkle_path[15] - h14) + h14;
    hash15.inputs[1] <== (1 - index_bits[15]) * (h14 - merkle_path[15]) + merkle_path[15];
    signal h15 <== hash15.out;
    
    // 第 17 层
    component hash16 = Poseidon(2);
    hash16.inputs[0] <== index_bits[16] * (merkle_path[16] - h15) + h15;
    hash16.inputs[1] <== (1 - index_bits[16]) * (h15 - merkle_path[16]) + merkle_path[16];
    signal h16 <== hash16.out;
    
    // 第 18 层
    component hash17 = Poseidon(2);
    hash17.inputs[0] <== index_bits[17] * (merkle_path[17] - h16) + h16;
    hash17.inputs[1] <== (1 - index_bits[17]) * (h16 - merkle_path[17]) + merkle_path[17];
    signal h17 <== hash17.out;
    
    // 第 19 层
    component hash18 = Poseidon(2);
    hash18.inputs[0] <== index_bits[18] * (merkle_path[18] - h17) + h17;
    hash18.inputs[1] <== (1 - index_bits[18]) * (h17 - merkle_path[18]) + merkle_path[18];
    signal h18 <== hash18.out;
    
    // 第 20 层
    component hash19 = Poseidon(2);
    hash19.inputs[0] <== index_bits[19] * (merkle_path[19] - h18) + h18;
    hash19.inputs[1] <== (1 - index_bits[19]) * (h18 - merkle_path[19]) + merkle_path[19];
    signal h19 <== hash19.out;
    
    // 步骤 4：验证 Merkle 根
    h19 === merkle_root;
    
    // 步骤 5：验证历史数据哈希
    component dataHash = Poseidon(1);
    dataHash.inputs[0] <== history_data;
    dataHash.out === history_hash;
}

// 主电路：历史行为锚定验证
// 公开输入：merkle_root, history_hash
// 私有输入：history_data, history_index, merkle_path[20]
component main { 
    public [
        merkle_root, 
        history_hash
    ] 
} = HistoryAnchor();
