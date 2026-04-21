/**
 * ZKP 密钥路径配置
 * 
 * 安全规范：
 * - 密钥文件路径绝不可硬编码在业务逻辑中
 * - 必须通过环境变量动态配置，防止 Trusted Setup 污染
 * - 生产环境应设置目录权限为 700（仅所有者可读写）
 * 
 * 隐私保护：
 * - .zkey 文件（证明密钥）：用于生成零知识证明，必须保密
 * - vkey.json（验证密钥）：用于链上验证，可以公开
 * - .wasm 文件（电路编译产物）：用于前端证明生成
 */

import path from 'path';

/** 须在仓库 backend 目录下启动进程（yarn dev / yarn start:dist），以便与 Vite 产物 dist 一致 */
const backendRoot = process.cwd();

/**
 * ZKP 密钥文件根目录
 * 默认路径：backend/zkp/keys
 *
 * 环境变量优先级：
 * 1. ZKP_KEYS_PATH（生产环境）
 * 2. 默认路径（开发环境）
 */
const keysDir = process.env.ZKP_KEYS_PATH || path.join(backendRoot, 'zkp', 'keys');

/**
 * ZKP 电路文件根目录
 * 默认路径：backend/zkp/circuits
 */
const circuitsDir = process.env.ZKP_CIRCUITS_PATH || path.join(backendRoot, 'zkp', 'circuits');

/**
 * 验证器合约目录
 * 默认路径：backend/zkp/verifiers
 */
const verifiersDir = process.env.ZKP_VERIFIERS_PATH || path.join(backendRoot, 'zkp', 'verifiers');

/**
 * 电路白名单（防止路径遍历攻击）
 * 仅允许合法的电路名称，拒绝恶意输入
 */
const ALLOWED_CIRCUITS = [
  'identity',
  'nullifier',
  'merkle-tree',
  'poseidon',
  'claim',
];

/**
 * 获取指定电路的密钥文件路径
 * 
 * @param {string} circuitName - 电路名称（如 'identity'、'nullifier'）
 * @returns {Object} 密钥文件路径对象
 * 
 * 安全注释：
 * - 路径验证：确保路径在允许的目录内，防止路径遍历攻击
 * - 白名单机制：仅允许预定义的电路名称
 */
export function getZKPPaths(circuitName) {
  // 白名单验证：仅允许合法的电路名称
  if (!ALLOWED_CIRCUITS.includes(circuitName)) {
    console.error(`[ZKP 安全] 非法电路名称：${circuitName}，仅允许：${ALLOWED_CIRCUITS.join(', ')}`);
    throw new Error(`非法电路名称：${circuitName}，仅允许：${ALLOWED_CIRCUITS.join(', ')}`);
  }

  // 路径规范化：防止路径遍历（如 ../../../etc/passwd）
  const safeName = path.basename(circuitName);

  return {
    zkey: path.join(keysDir, `${safeName}.zkey`),
    vkey: path.join(keysDir, `${safeName}_vkey.json`),
    wasm: path.join(keysDir, `${safeName}.wasm`),
    circuit: path.join(circuitsDir, `${safeName}.circom`),
    verifier: path.join(verifiersDir, `${safeName}.sol`),
  };
}

/**
 * 验证密钥文件是否存在
 * 
 * @param {string} circuitName - 电路名称
 * @returns {Promise<boolean>} 是否存在
 * 
 * 安全注释：
 * - 启动时检查：应用启动时应验证所有必需密钥文件存在
 * - 日志脱敏：错误信息不暴露完整路径，防止信息泄露
 */
export async function verifyKeyFilesExist(circuitName) {
  const fs = await import('fs');
  const paths = getZKPPaths(circuitName);
  
  const requiredFiles = [
    { path: paths.zkey, name: '.zkey（证明密钥）' },
    { path: paths.wasm, name: '.wasm（电路编译产物）' },
  ];
  
  let allExist = true;
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      console.error(`[ZKP 安全] 密钥文件缺失：${file.name}`);
      allExist = false;
    }
  }
  
  // vkey.json 可选（仅链上验证需要）
  if (!fs.existsSync(paths.vkey)) {
    console.warn(`[ZKP 警告] 验证密钥文件缺失：${circuitName}_vkey.json（如需要链上验证则必需）`);
  }
  
  return allExist;
}

/**
 * 获取所有可用电路的密钥路径
 * 
 * @returns {Object} 电路名称到路径的映射
 */
export function getAllCircuitPaths() {
  const circuits = {};
  
  for (const circuitName of ALLOWED_CIRCUITS) {
    try {
      circuits[circuitName] = getZKPPaths(circuitName);
    } catch (error) {
      console.warn(`[ZKP] 电路 ${circuitName} 路径配置失败：${error.message}`);
    }
  }
  
  return circuits;
}

/**
 * 验证密钥文件完整性（可选：计算哈希校验）
 * 
 * 安全增强：
 * - 防止密钥文件被篡改
 * - 生产环境应存储可信哈希
 * 
 * @param {string} circuitName - 电路名称
 * @param {string} expectedHash - 预期哈希值（可选）
 * @returns {Promise<boolean>} 完整性验证是否通过
 */
export async function verifyKeyFileIntegrity(circuitName, expectedHash) {
  if (!expectedHash) {
    console.warn(`[ZKP] 未提供预期哈希值，跳过完整性验证`);
    return true;
  }
  
  const fs = await import('fs');
  const crypto = await import('crypto');
  const paths = getZKPPaths(circuitName);
  
  // 计算 .zkey 文件的 SHA-256 哈希
  const fileBuffer = await fs.promises.readFile(paths.zkey);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  if (hash !== expectedHash) {
    console.error(`[ZKP 严重] 密钥文件完整性验证失败！可能存在篡改或损坏`);
    return false;
  }
  
  return true;
}

// 导出配置对象
export const zkpConfig = {
  keysDir,
  circuitsDir,
  verifiersDir,
  allowedCircuits: ALLOWED_CIRCUITS,
};
