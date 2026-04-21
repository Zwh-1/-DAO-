/**
 * 前端存储配置文件
 * 
 * 职责：
 * - 管理合约 ABI 文件存储路径
 * - 管理 ZKP 电路密钥与证明文件存储路径
 * - 统一 ZKP 相关文件至 public/circuits 目录
 * 
 * 安全规范：
 * - 电路密钥目录必须排除出版本控制（.gitignore）
 * - 敏感文件权限设置为 600（仅所有者可读写）
 * - 支持多环境路径隔离（开发/测试/生产）
 * 
 * 隐私保护：
 * - 电路密钥（.zkey）和证明文件包含敏感数据
 * - 禁止将 zkp/circuits 目录上传至 Git 或公开存储
 * 
 * 前端特殊处理：
 * - 电路文件放置在 public 目录，支持浏览器直接访问
 * - ABI 文件作为模块导入，支持 TypeScript 类型
 */

/**
 * 存储路径配置
 */
export const storageConfig = {
  // 根目录（相对于 frontend）
  rootDir: typeof window === 'undefined' ? process.cwd() : '',
  
  // 合约 ABI 存储目录（模块导入）
  // 用途：存储编译后的合约 ABI 文件，供前端调用合约使用
  abisDir: 'lib/contracts/abis',
  
  // ZKP 电路文件统一存储目录（public 目录）
  // 用途：集中管理电路密钥、证明文件、公开输入数据
  // 注意：包含敏感数据，必须排除出版本控制
  zkpDir: 'public/circuits',
  
  // 电路密钥存储目录（敏感）
  // 用途：存储 .zkey、vkey.json、wasm 等电路密钥文件
  // 安全：权限 600，仅所有者可读写
  circuitsDir: 'public/circuits',
  keysDir: 'public/circuits/keys',
  
  // 运行时证明文件存储目录（敏感）
  // 用途：存储电路生成的证明文件（.json 格式）
  proofsDir: 'public/circuits/proofs',
  
  // 公开输入数据存储目录（部分敏感）
  // 用途：存储电路的公开输入数据（Public Inputs）
  // 注意：包含部分敏感数据（如 Merkle Root），需脱敏日志
  publicInputsDir: 'public/circuits/publicInputs',
  
  // 临时文件目录（可选）
  // 用途：存储临时生成的中间文件
  tmpDir: 'public/circuits/tmp',
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
 * 支持的文件类型
 */
export const fileTypes = {
  // ABI 文件
  abi: '.json',
  
  // 电路密钥文件
  zkey: '.zkey',
  vkey: '.vkey',
  
  // WASM 文件
  wasm: '.wasm',
  
  // 证明文件
  proof: '.json',
  
  // 公开输入
  publicInputs: '.json',
};

/**
 * 电路文件列表
 * 
 * 说明：
 * - 核心电路：必须加载
 * - 验证电路：可选加载
 */
export const circuitFiles = {
  // 身份注册电路
  identity: {
    wasm: 'identity.wasm',
    zkey: 'identity.zkey',
    vkey: 'identity_vkey.json',
  },
  
  // 匿名空投申领电路
  anonymousClaim: {
    wasm: 'anonymous_claim.wasm',
    zkey: 'anonymous_claim.zkey',
    vkey: 'anonymous_claim_vkey.json',
  },
  
  // 其他电路...
};

/**
 * 合约 ABI 文件列表
 * 
 * 说明：
 * - 核心合约：必须加载
 * - 辅助合约：按需加载
 */
export const abiFiles = [
  // 核心合约
  'ClaimVault',
  'ClaimVaultZK',
  'IdentityRegistry',
  'OracleManager',
  'SBT',
  
  // 空投申领相关
  'AnonymousClaim',
  
  // 支付通道
  'PaymentChannel',
  
  // 治理相关
  'Governance',
  'ChallengeManager',
  'ArbitratorPool',
  
  // 多重签名钱包
  'MultiSigWallet',
];

/**
 * 获取电路文件完整路径
 * 
 * @param circuitName 电路名称
 * @param fileType 文件类型（'wasm' | 'zkey' | 'vkey'）
 * @returns 完整路径
 */
export function getCircuitFilePath(circuitName: string, fileType: string): string {
  const circuit = circuitFiles[circuitName as keyof typeof circuitFiles];
  if (!circuit) {
    throw new Error(`未知电路：${circuitName}`);
  }
  
  const fileName = circuit[fileType as keyof typeof circuit];
  if (!fileName) {
    throw new Error(`电路 ${circuitName} 没有 ${fileType} 文件`);
  }
  
  return `/${storageConfig.circuitsDir}/${fileName}`;
}

/**
 * 获取 ABI 文件导入路径
 * 
 * @param contractName 合约名称
 * @returns 导入路径
 */
export function getAbiImportPath(contractName: string): string {
  return `@/lib/contracts/abis/${contractName}.json`;
}

/**
 * 导出存储配置
 */
export const storageUtils = {
  getCircuitFilePath,
  getAbiImportPath,
};
