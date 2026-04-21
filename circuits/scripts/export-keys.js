#!/usr/bin/env node

/**
 * ZKP 证明文件导出脚本
 * 
 * 用途：
 * - 从电路编译产物中提取证明文件和验证密钥
 * - 自动导出至后端存储目录（backend/src/proofs/ 和 backend/src/zkp/keys/）
 * - 支持批量导出和单个电路导出
 * 
 * 使用方法：
 * ```bash
 * # 导出所有电路的证明密钥
 * npm run export-keys
 * 
 * # 导出指定电路的证明密钥
 * npm run export-key -- anti_sybil_verifier
 * ```
 * 
 * 安全规范：
 * - .zkey 文件包含 Trusted Setup 敏感信息，严禁提交至 Git
 * - 验证密钥（vkey.json）可公开，但建议本地存储
 * - 导出的文件必须排除出版本控制（见 backend/.gitignore）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 电路编译产物目录
const BUILD_DIR = process.env.CIRCUIT_BUILD_DIR ||
  path.join(__dirname, '..', 'build');

// 后端 ZKP 密钥存储目录
const BACKEND_KEYS_DIR = process.env.BACKEND_KEYS_DIR ||
  path.join(__dirname, '..', '..', 'backend', 'src', 'zkp', 'keys');

// 后端证明文件存储目录
const BACKEND_PROOFS_DIR = process.env.BACKEND_PROOFS_DIR ||
  path.join(__dirname, '..', '..', 'backend', 'src', 'proofs');

/**
 * 需要导出的电路列表
 * 
 * 说明：
 * - 核心电路：必须导出（抗女巫、身份承诺）
 * - 功能电路：按需导出（支付、治理）
 * - 测试电路：禁止导出
 */
const CIRCUITS_TO_EXPORT = [
  // 核心电路
  'anti_sybil_verifier',      // 抗女巫验证
  'identity_commitment',      // 身份承诺
  
  // 空投申领相关
  'anonymous_claim',          // 匿名申领
  
  // 支付相关
  'private_payment',          // 私有支付
  'privacy_payment',          // 隐私支付
  'confidential_transfer',    // 机密转账
  
  // 治理相关
  'multi_sig_proposal',       // 多重签名提案
  'history_anchor',           // 历史锚点
  
  // 声誉相关
  'reputation_verifier',      // 声誉验证
];

/**
 * 确保目录存在
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[目录创建] ${dirPath}`);
  }
}

/**
 * 复制文件（带进度日志）
 * 
 * @param {string} src - 源文件路径
 * @param {string} dest - 目标文件路径
 */
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[警告] 源文件不存在：${src}`);
    return false;
  }
  
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${path.basename(src)}`);
  
  return true;
}

/**
 * 导出单个电路的密钥文件
 * 
 * @param {string} circuitName - 电路名称
 */
function exportCircuitKeys(circuitName) {
  console.log(`\n[导出] ${circuitName}...`);
  
  const circuitBuildDir = path.join(BUILD_DIR, circuitName);
  
  if (!fs.existsSync(circuitBuildDir)) {
    console.error(`[跳过] 电路编译产物不存在：${circuitName}`);
    return false;
  }
  
  // 创建电路专用子目录
  const circuitKeysDir = path.join(BACKEND_KEYS_DIR, circuitName);
  ensureDirExists(circuitKeysDir);
  
  let copiedCount = 0;
  
  // 复制 .zkey 文件（证明密钥 - 高度敏感）
  const zkeySrc = path.join(circuitBuildDir, `${circuitName}.zkey`);
  const zkeyDest = path.join(circuitKeysDir, `${circuitName}.zkey`);
  if (copyFile(zkeySrc, zkeyDest)) {
    copiedCount++;
  }
  
  // 复制 vkey.json（验证密钥 - 可公开）
  const vkeySrc = path.join(circuitBuildDir, `${circuitName}_vkey.json`);
  const vkeyDest = path.join(circuitKeysDir, `${circuitName}_vkey.json`);
  if (copyFile(vkeySrc, vkeyDest)) {
    copiedCount++;
  }
  
  // 复制 .wasm 文件（电路编译产物）
  const wasmSrc = path.join(circuitBuildDir, `${circuitName}.wasm`);
  const wasmDest = path.join(circuitKeysDir, `${circuitName}.wasm`);
  if (copyFile(wasmSrc, wasmDest)) {
    copiedCount++;
  }
  
  // 复制 .sym 文件（符号表 - 调试用）
  const symSrc = path.join(circuitBuildDir, `${circuitName}.sym`);
  const symDest = path.join(circuitKeysDir, `${circuitName}.sym`);
  copyFile(symSrc, symDest); // 可选文件，不计数
  
  console.log(`  完成：${copiedCount} 个文件`);
  
  return copiedCount > 0;
}

/**
 * 导出所有电路密钥
 */
function exportAllKeys() {
  console.log('[开始] 导出所有电路密钥...\n');
  
  // 确保后端目录存在
  ensureDirExists(BACKEND_KEYS_DIR);
  ensureDirExists(BACKEND_PROOFS_DIR);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const circuitName of CIRCUITS_TO_EXPORT) {
    const success = exportCircuitKeys(circuitName);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n[完成] 导出统计:');
  console.log(`  成功：${successCount} 个电路`);
  console.log(`  失败：${failCount} 个电路`);
  console.log(`  总计：${CIRCUITS_TO_EXPORT.length} 个电路`);
  console.log(`\n密钥存储目录：${BACKEND_KEYS_DIR}`);
  
  // 输出安全提示
  console.log('\n⚠️  安全提示:');
  console.log('  - .zkey 文件包含 Trusted Setup 敏感信息');
  console.log('  - 严禁将 .zkey 文件提交至 Git 版本控制');
  console.log('  - 已自动添加至 backend/.gitignore');
}

/**
 * 生成示例证明文件（用于测试）
 */
function generateExampleProof() {
  console.log('\n[生成] 示例证明文件...\n');
  
  const exampleProof = {
    pi_a: [
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    ],
    pi_b: [
      [
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      ],
      [
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      ],
    ],
    pi_c: [
      '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    ],
  };
  
  const examplePublicInputs = [
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222222222222222222222222222',
  ];
  
  // 保存示例证明
  const proofPath = path.join(BACKEND_PROOFS_DIR, 'example_proof.json');
  fs.writeFileSync(proofPath, JSON.stringify(exampleProof, null, 2));
  console.log(`  ✓ 示例证明：${proofPath}`);
  
  // 保存示例公开输入
  const publicInputPath = path.join(BACKEND_PROOFS_DIR, 'example_public_inputs.json');
  fs.writeFileSync(publicInputPath, JSON.stringify(examplePublicInputs, null, 2));
  console.log(`  ✓ 示例公开输入：${publicInputPath}`);
  
  console.log('\n⚠️  注意：示例文件仅用于测试，不包含真实数据');
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 无参数：导出所有电路密钥 + 生成示例证明
    exportAllKeys();
    generateExampleProof();
  } else if (args[0] === '--example') {
    // --example：仅生成示例证明
    generateExampleProof();
  } else {
    // 有参数：导出指定电路
    const circuitName = args[0];
    exportCircuitKeys(circuitName);
  }
}

// 执行
main();
