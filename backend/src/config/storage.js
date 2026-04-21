/**
 * 存储配置文件
 * 
 * 职责：
 * - 管理合约 ABI 文件存储路径
 * - 管理 ZKP 电路密钥与证明文件存储路径
 * - 统一 ZKP 相关文件至 zkp/circuits 目录
 * 
 * 安全规范：
 * - 电路密钥目录必须排除出版本控制（.gitignore）
 * - 敏感文件权限设置为 600（仅所有者可读写）
 * - 支持多环境路径隔离（开发/测试/生产）
 * 
 * 隐私保护：
 * - 电路密钥（.zkey）和证明文件包含敏感数据
 * - 禁止将 zkp/circuits 目录上传至 Git 或公开存储
 */

import { join } from 'node:path';

/** 后端源码根（backend/src）；须在 backend 目录下启动以解析 ABI 等路径 */
const SRC_ROOT = join(process.cwd(), 'src');

/**
 * 存储路径配置
 */
export const storageConfig = {
  // 根目录
  rootDir: SRC_ROOT,
  
  // 合约 ABI 存储目录
  // 用途：存储编译后的合约 ABI 文件，供后端调用合约使用
  abisDir: join(SRC_ROOT, 'abis'),
  
  // ZKP 电路文件统一存储目录
  // 用途：集中管理电路密钥、证明文件、公开输入数据
  // 注意：包含敏感数据，必须排除出版本控制
  zkpDir: join(SRC_ROOT, 'zkp'),
  
  // 电路密钥存储目录（敏感）
  // 用途：存储 .zkey、vkey.json、wasm 等电路密钥文件
  // 安全：权限 600，仅所有者可读写
  circuitsDir: join(SRC_ROOT, 'zkp', 'circuits'),
  keysDir: join(SRC_ROOT, 'zkp', 'circuits', 'keys'),
  
  // 运行时证明文件存储目录（敏感）
  // 用途：存储电路生成的证明文件（.json 格式）
  proofsDir: join(SRC_ROOT, 'zkp', 'circuits', 'proofs'),
  
  // 公开输入数据存储目录（部分敏感）
  // 用途：存储电路的公开输入数据（Public Inputs）
  // 注意：包含部分敏感数据（如 Merkle Root），需脱敏日志
  publicInputsDir: join(SRC_ROOT, 'zkp', 'circuits', 'publicInputs'),
  
  // 临时文件目录（可选）
  // 用途：存储临时生成的中间文件
  tmpDir: join(SRC_ROOT, 'tmp'),
};

/**
 * 证明文件过期配置（毫秒）
 * 
 * 设计理由：
 * - 证明文件仅在验证时需要，验证后可删除
 * - 防止磁盘溢出，设置合理的过期时间
 * - 开发环境保留时间较长，便于调试
 */
export const proofExpiration = {
  // 开发环境：24 小时
  development: 24 * 60 * 60 * 1000,
  
  // 测试环境：1 小时
  test: 60 * 60 * 1000,
  
  // 生产环境：10 分钟（验证后立即删除）
  production: 10 * 60 * 1000,
};

/**
 * 文件权限配置
 * 
 * 安全规范：
 * - 证明文件：600（仅所有者可读写）
 * - ABI 文件：644（全局可读，所有者可写）
 */
export const filePermissions = {
  // 敏感文件（证明文件）
  sensitive: 0o600,
  
  // 公开文件（ABI 文件）
  public: 0o644,
};

/**
 * 支持的文件类型
 */
export const fileTypes = {
  // 合约 ABI 文件扩展名
  abi: '.json',
  
  // 证明文件扩展名
  proof: '.json',
  
  // 公开输入扩展名
  publicInput: '.json',
  
  // ZKP 密钥扩展名
  zkey: '.zkey',
  
  // WASM 电路文件扩展名
  wasm: '.wasm',
};

/**
 * 获取存储路径（带环境隔离）
 * 
 * @param {string} type - 存储类型 ('abis' | 'proofs' | 'publicInputs')
 * @param {string} subDir - 子目录（可选，用于环境隔离）
 * @returns {string} 存储路径
 * 
 * 使用示例：
 * ```javascript
 * // 开发环境证明存储
 * const devProofsPath = getStoragePath('proofs', 'development');
 * 
 * // 生产环境 ABI 存储
 * const prodAbisPath = getStoragePath('abis', 'production');
 * ```
 */
export function getStoragePath(type, subDir = null) {
  const basePaths = {
    abis: storageConfig.abisDir,
    proofs: storageConfig.proofsDir,
    publicInputs: storageConfig.publicInputsDir,
    tmp: storageConfig.tmpDir,
  };
  
  const basePath = basePaths[type];
  
  if (!basePath) {
    throw new Error(`[存储配置] 未知的存储类型：${type}`);
  }
  
  // 支持子目录隔离（如按环境、按用户）
  if (subDir) {
    return join(basePath, subDir);
  }
  
  return basePath;
}

/**
 * 获取证明文件过期时间（根据环境）
 * 
 * @param {string} env - 环境名称（可选，默认 process.env.NODE_ENV）
 * @returns {number} 过期时间（毫秒）
 */
export function getProofExpiration(env = process.env.NODE_ENV) {
  const expirationMap = {
    development: proofExpiration.development,
    test: proofExpiration.test,
    production: proofExpiration.production,
  };
  
  return expirationMap[env] || proofExpiration.development;
}

/**
 * 导出所有配置
 */
export const storage = {
  storageConfig,
  proofExpiration,
  filePermissions,
  fileTypes,
  getStoragePath,
  getProofExpiration,
};
