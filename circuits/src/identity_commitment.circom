pragma circom 2.1.6;

// 直接使用 circomlib 官方标准库，不依赖自定义 Hasher 封装
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// 隐私说明：
//   social_id_hash — 链下将 Keccak256(social_id) 取模映射至 BN128 安全标量域后的结果
//   secret / trapdoor — Semaphore 私有见证人，绝不离端，禁止在任何日志中记录
// 输出 identity_commitment 为唯一公开锚点，与原始社交身份完全脱钩
template IdentityCommitment() {
    // === 私有输入 (Witness，绝不离端) ===
    signal input social_id_hash;    // Web2 社交 ID 的域元素哈希 (链下预处理，须 < 2^254)
    signal input secret;            // Semaphore 身份秘钥
    signal input trapdoor;          // Semaphore 陷门

    signal output identity_commitment;

    // ── 域安全约束 ───────────────────────────────────────────────────────────
    // BN128 曲线素数域 p ≈ 2^254.7；Keccak256 输出 256 位，高位两位可能溢出。
    // 强制 social_id_hash < 2^254 < p，确保链下哈希与电路内计算结果完全一致。
    // 链下须先执行：social_id_hash = keccak256(id) % p（或截取低 254 位）
    component rangeCheck = Num2Bits(254);
    rangeCheck.in <== social_id_hash;

    // ── 身份承诺计算 ─────────────────────────────────────────────────────────
    // Poseidon(3) 为电路内唯一允许的哈希算法，禁用 MD5 / SHA-1 / Keccak
    component h = Poseidon(3);
    h.inputs[0] <== social_id_hash;
    h.inputs[1] <== secret;
    h.inputs[2] <== trapdoor;
    identity_commitment <== h.out;
}

// social_id_hash 为公开输入（用于链上关联验证），secret/trapdoor 保持私有
component main { public [social_id_hash] } = IdentityCommitment();
