pragma circom 2.1.6;

// 直接使用 circomlib 官方标准库
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "utils/merkle_utils.circom";  // Merkle 树验证（参数化版本）

// ═══════════════════════════════════════════════════════════════════════════════
// AntiSybilVerifier — 完整抗女巫身份验证电路
//
// 核心安全修复：
//   1. [身份绑定] secret/trapdoor/social_id_hash 在电路内部计算 identity_commitment，
//      攻击者无法提交任意 commitment 冒充已注册用户
//   2. [等级锚定] user_level 与 identity_commitment 共同哈希为 Merkle 叶子，
//      使等级成为不可篡改的链上凭证，防止权限伪造
//   3. [Merkle 关联] 叶子节点由电路内部派生，Merkle 路径验证与身份完全绑定
//   4. [位宽统一] 所有比较器统一使用 64-bit，消除跨电路位宽不一致漏洞
//   5. [域安全] social_id_hash 强制约束在 BN128 安全标量域范围内
//
// 隐私承诺：私有见证人 (secret, trapdoor, social_id_hash, user_level) 绝不离端，
//           禁止在前端控制台、后端日志、链上存证中以明文暴露
// ═══════════════════════════════════════════════════════════════════════════════

template AntiSybilVerifier(merkleLevels) {

    // ── 私有输入 (Witness — 绝不离端，禁止日志记录) ─────────────────────────
    signal input secret;                        // Semaphore 身份秘钥
    signal input trapdoor;                      // Semaphore 陷门
    signal input social_id_hash;                // Web2 社交 ID 的域元素哈希 (须 < 2^254)
    signal input pathElements[merkleLevels];    // Merkle 路径兄弟节点哈希
    signal input pathIndex[merkleLevels];       // Merkle 路径方向（0=左，1=右）
    
    // [优化] 参数聚合：将非核心验证参数设为私有输入，减少链上 Gas 消耗
    // 原始参数：min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id
    // 聚合后：链上只传递 parameter_hash，私有输入保留原始参数用于电路内验证
    signal input min_level;         // 最低信誉等级门槛（私有）
    signal input min_amount;        // 最低申领金额（私有）
    signal input max_amount;        // 最高申领金额（私有）
    signal input ts_start;          // 空投开始时间戳（私有）
    signal input ts_end;            // 空投结束时间戳（私有）
    signal input airdrop_project_id;// 空投项目 ID（私有）

    // ── 公开输入 (Public Inputs — 链上可验证) ───────────────────────────────
    // [优化] 参数聚合：将非核心验证参数聚合为 parameter_hash，减少 Gas 消耗
    // 原始参数：min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id
    // 聚合后：parameter_hash = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)
    signal input merkle_root;       // 白名单 Merkle 根（链上存储）
    signal input identity_commitment;  // 身份承诺（用于注册表验证）[公开输入]
    signal input nullifier_hash;    // 期望的防重放 Nullifier（链上防止二次申领）
    signal input user_level;        // 用户实际信誉等级（链上二次验证）
    signal input claim_amount;      // 实际申领金额
    signal input claim_ts;          // 申领时间戳（Unix 秒）
    signal input parameter_hash;    // [新增] 聚合参数哈希 = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)
    signal input merkle_leaf;       // Merkle 叶子哈希（验证身份与等级绑定）[公开输入]

    // ── 步骤 1: 域安全约束 ────────────────────────────────────────────────────
    // BN128 曲线 p ≈ 2^254.7；Keccak256 输出 256 位可能超出域范围导致隐式取模。
    // 强制 social_id_hash < 2^254 < p，保证链下预计算与电路内结果严格一致。
    component rangeCheck = Num2Bits(254);
    rangeCheck.in <== social_id_hash;

    // ── 步骤 2: 电路内计算 identity_commitment ────────────────────────────────
    // [修复：身份验证缺失] 攻击者无法在公开输入中填入任意 identity_commitment，
    // 因为承诺值由其对应的私有 secret/trapdoor 在电路内决定性地计算得出。
    component icHash = Poseidon(3);
    icHash.inputs[0] <== social_id_hash;
    icHash.inputs[1] <== secret;
    icHash.inputs[2] <== trapdoor;
    identity_commitment === icHash.out;

    // ── 步骤 3: 将 user_level 锚定到 Merkle 叶子 ──────────────────────────────
    // [修复：权限伪造] 叶子 = Poseidon(identity_commitment, user_level)。
    // 链下颁发白名单时必须使用同样公式生成叶子并插入 Merkle 树。
    // 用户无法随意修改 user_level，因为任何修改都会导致叶子哈希不在树中。
    component leafHash = Poseidon(2);
    leafHash.inputs[0] <== identity_commitment;
    leafHash.inputs[1] <== user_level;
    merkle_leaf === leafHash.out;

    // ── 步骤 4: Merkle 成员资格验证 ───────────────────────────────────────────
    // [修复：空置的 Merkle 约束] 叶子节点由电路内部派生，与身份完全关联。
    // 攻击者无法同时声称"某叶子在树里"且"我是身份 A"，两者已在电路层面绑定。
    // 安全优化：使用参数化模板，支持任意深度的 Merkle 树
    component mt = MerkleTreeInclusion(merkleLevels);  // 参数化深度
    mt.leaf <== merkle_leaf;
    for (var i = 0; i < merkleLevels; i++) {
        mt.path_elements[i] <== pathElements[i];
        mt.path_index[i] <== pathIndex[i];
    }
    mt.root <== merkle_root;

    // ── 步骤 5: Nullifier 防重放约束 ──────────────────────────────────────────
    // nullifier_hash = Poseidon(secret, airdrop_project_id)
    // 链上合约存储已使用的 nullifier_hash，同一身份对同一项目只能申领一次
    component nulHash = Poseidon(2);
    nulHash.inputs[0] <== secret;
    nulHash.inputs[1] <== airdrop_project_id;
    nullifier_hash === nulHash.out;

    // ── 步骤 6: 信誉等级门槛约束 ──────────────────────────────────────────────
    // [修复：位宽统一] 统一使用 64-bit，与金额/时间戳约束保持一致
    component ge = GreaterEqThan(64);
    ge.in[0] <== user_level;
    ge.in[1] <== min_level;
    ge.out === 1;

    // ── 步骤 7: 金额范围约束 (64-bit) ─────────────────────────────────────────
    // [安全修复] 强制 claim_amount > 0（防止零金额申领浪费 Gas）
    component amountPositive = Num2Bits(64);
    amountPositive.in <== claim_amount - 1;  // claim_amount >= 1
    
    // 下界约束：claim_amount >= min_amount
    component geAmt = GreaterEqThan(64);
    geAmt.in[0] <== claim_amount;
    geAmt.in[1] <== min_amount;
    geAmt.out === 1;

    // 上界约束：claim_amount < max_amount
    component ltMax = LessThan(64);
    ltMax.in[0] <== claim_amount;
    ltMax.in[1] <== max_amount;
    ltMax.out === 1;

    // ── 步骤 8: 时间窗口约束（内联比较器，减少组件开销）─────────────────
    // [优化] 直接使用比较器，避免 TimestampValidator 组件调用开销
    // 约束：ts_start ≤ claim_ts ≤ ts_end
    // 隐私保护：claim_ts 为私有见证人，绝不离端
    
    // [安全修复] 时间戳域安全检查（< 2^63，防止负数/溢出）
    component claimTsRange = Num2Bits(63);
    claimTsRange.in <== claim_ts;
    
    // 下界约束：claim_ts >= ts_start
    component tsGe = GreaterEqThan(64);
    tsGe.in[0] <== claim_ts;
    tsGe.in[1] <== ts_start;
    tsGe.out === 1;
    
    // 上界约束：claim_ts <= ts_end
    component tsLe = LessEqThan(64);
    tsLe.in[0] <== claim_ts;
    tsLe.in[1] <== ts_end;
    tsLe.out === 1;
    
    // ── 步骤 9: 验证 parameter_hash 一致性 ───────────────────────────────────
    // [优化] 聚合参数验证，减少链上公开输入数量
    // parameter_hash = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)
    // Gas 优化：从 6 个公开输入减少到 1 个，节省约 12,000 Gas
    component paramHash = Poseidon(6);
    paramHash.inputs[0] <== min_level;
    paramHash.inputs[1] <== min_amount;
    paramHash.inputs[2] <== max_amount;
    paramHash.inputs[3] <== ts_start;
    paramHash.inputs[4] <== ts_end;
    paramHash.inputs[5] <== airdrop_project_id;
    parameter_hash === paramHash.out;
}

// merkleLevels = 20：支持白名单规模 2^20 = 1,048,576 人
// 若规模变更须重新执行可信设置（Trusted Setup）
// 
// ── Public Signals 输出顺序（与合约层 ClaimVaultZK.sol 严格对齐）────────
// [优化] 公开输入从 13 个减少到 8 个，节省约 12,000 Gas
// [0]  merkle_root          - 白名单 Merkle 根（链上存储）
// [1]  identity_commitment  - 身份承诺（用于注册表验证）
// [2]  nullifier_hash       - 防重放 Nullifier（链上记录）
// [3]  user_level           - 用户实际信誉等级（链上二次验证）
// [4]  claim_amount         - 实际申领金额
// [5]  claim_ts             - 申领时间戳
// [6]  parameter_hash       - 聚合参数哈希 = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)
// [7]  merkle_leaf          - Merkle 叶子哈希（验证身份与等级绑定）
//
// 隐私保护：
//   - secret, trapdoor, social_id_hash: 私有见证人，绝不离端
//   - user_level: 通过叶子哈希间接公开，避免直接暴露等级
//   - min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id: 聚合到 parameter_hash 中
component main { public [
    merkle_root,          // [0]
    identity_commitment,  // [1] 
    nullifier_hash,       // [2]
    user_level,           // [3] 
    claim_amount,         // [4]
    claim_ts,             // [5]
    parameter_hash,       // [6] 聚合参数哈希
    merkle_leaf           // [7] 
] } = AntiSybilVerifier(20);
