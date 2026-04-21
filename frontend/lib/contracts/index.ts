/**
 * 合约与电路模块统一导出
 * 
 * 功能：
 * - 统一导出 ABI 加载器
 * - 统一导出电路加载器
 * - 统一导出合约地址配置
 * - 统一导出类型定义
 * - 提供便捷的导入接口
 */

// ABI 加载器
export {
  loadAbi,
  loadAbis,
  clearAbiCache,
  getCachedAbi,
  getLoadedAbiNames,
  preloadCoreAbis,
  abiLoader,
} from './abi-loader';

export type { AbiFile } from './abi-loader';

// 电路加载器
export {
  loadCircuit,
  loadCircuits,
  saveProof,
  getProof,
  deleteProof,
  cleanupExpiredProofs,
  clearCircuitCache,
  getCachedCircuit,
  getLoadedCircuitNames,
  preloadCoreCircuits,
  startProofCleanup,
  circuitLoader,
} from './circuit-loader';

export type {
  CircuitFiles,
  LoadedCircuit,
  ProofFile,
} from './circuit-loader';

// 合约地址配置
export {
  getNetworkConfig,
  getContractAddress,
  getAllContractAddresses,
  setContractAddress,
  getDefaultChainId,
  getSupportedNetworks,
  isNetworkSupported,
  contractConfig,
} from './addresses';

// 类型定义
export type {
  BaseContract,
  ClaimVaultAbi,
  ClaimVaultZKAbi,
  IdentityRegistryAbi,
  SBTAbi,
  AnonymousClaimAbi,
  OracleManagerAbi,
  GovernanceAbi,
  ContractMap,
  GetContractType,
  ContractAddresses,
  NetworkConfig,
  ContractConfig,
  InferContractFunctionReturnType,
  InferContractEvent,
} from './types';

// 工具函数
export {
  getContractByAddress,
} from './types';

// 存储配置
export {
  storageConfig,
  proofExpiration,
  fileTypes,
  circuitFiles,
  abiFiles,
  getCircuitFilePath,
  getAbiImportPath,
  storageUtils,
} from '../config/storage';
