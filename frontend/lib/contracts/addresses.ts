/**
 * 合约地址配置
 * 
 * 功能：
 * - 管理不同网络的合约部署地址
 * - 支持多环境配置（开发/测试/生产）
 * 
 * 安全规范：
 * - 合约地址为公开信息，可提交至版本控制
 * - 不包含私钥或敏感信息
 */

import type { ContractAddresses, NetworkConfig } from './types';

/**
 * 开发网络配置（本地测试网）
 */
const developmentNetwork: NetworkConfig = {
  chainId: 31337, // Hardhat 本地链
  name: 'Hardhat Local',
  rpcUrl: 'http://127.0.0.1:8545',
  blockExplorer: undefined,
  contracts: {
    ClaimVault: process.env.NEXT_PUBLIC_CLAIM_VAULT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
    ClaimVaultZK: process.env.NEXT_PUBLIC_CLAIM_VAULT_ZK_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
    IdentityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
    SBT: process.env.NEXT_PUBLIC_SBT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
    AnonymousClaim: process.env.NEXT_PUBLIC_ANONYMOUS_CLAIM_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
    OracleManager: process.env.NEXT_PUBLIC_ORACLE_MANAGER_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
    Governance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
  },
};

/**
 * Sepolia 测试网配置
 */
const sepoliaNetwork: NetworkConfig = {
  chainId: 11155111,
  name: 'Sepolia Testnet',
  rpcUrl:
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
  blockExplorer: 'https://sepolia.etherscan.io',
  contracts: {
    // 部署后在环境变量中写入各合约地址（见 .env.local.example）
    ClaimVault: '0x0000000000000000000000000000000000000000',
    ClaimVaultZK: '0x0000000000000000000000000000000000000000',
    IdentityRegistry: '0x0000000000000000000000000000000000000000',
    SBT: '0x0000000000000000000000000000000000000000',
    AnonymousClaim: '0x0000000000000000000000000000000000000000',
    OracleManager: '0x0000000000000000000000000000000000000000',
    Governance: '0x0000000000000000000000000000000000000000',
  },
};

/**
 * Ethereum 主网配置
 */
const mainnetNetwork: NetworkConfig = {
  chainId: 1,
  name: 'Ethereum Mainnet',
  rpcUrl:
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  blockExplorer: 'https://etherscan.io',
  contracts: {
    // 部署后在环境变量中写入各合约地址（见 .env.local.example）
    ClaimVault: '0x0000000000000000000000000000000000000000',
    ClaimVaultZK: '0x0000000000000000000000000000000000000000',
    IdentityRegistry: '0x0000000000000000000000000000000000000000',
    SBT: '0x0000000000000000000000000000000000000000',
    AnonymousClaim: '0x0000000000000000000000000000000000000000',
    OracleManager: '0x0000000000000000000000000000000000000000',
    Governance: '0x0000000000000000000000000000000000000000',
  },
};

/**
 * 网络配置映射
 */
const networkConfigs: Record<number, NetworkConfig> = {
  [developmentNetwork.chainId]: developmentNetwork,
  [sepoliaNetwork.chainId]: sepoliaNetwork,
  [mainnetNetwork.chainId]: mainnetNetwork,
};

/**
 * 默认网络（从环境变量读取）
 */
const defaultChainId = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID
  ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID, 10)
  : 31337; // 默认使用开发网络

/**
 * 获取当前网络配置
 * 
 * @param chainId 链 ID（可选，不传则使用默认网络）
 * @returns 网络配置
 */
export function getNetworkConfig(chainId?: number): NetworkConfig {
  const id = chainId || defaultChainId;
  const config = networkConfigs[id];
  
  if (!config) {
    throw new Error(`不支持的网络：${id}`);
  }
  
  return config;
}

/**
 * 获取合约地址
 * 
 * @param contractName 合约名称
 * @param chainId 链 ID（可选，不传则使用默认网络）
 * @returns 合约地址
 */
export function getContractAddress(contractName: string, chainId?: number): `0x${string}` {
  const network = getNetworkConfig(chainId);
  const address = network.contracts[contractName];
  
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    throw new Error(`合约 ${contractName} 在 ${network.name} 上未部署`);
  }
  
  return address;
}

/**
 * 获取所有合约地址
 * 
 * @param chainId 链 ID（可选）
 * @returns 合约地址映射
 */
export function getAllContractAddresses(chainId?: number): ContractAddresses {
  const network = getNetworkConfig(chainId);
  return network.contracts;
}

/**
 * 更新合约地址（运行时）
 * 
 * @param contractName 合约名称
 * @param address 新地址
 * @param chainId 链 ID（可选）
 */
export function setContractAddress(
  contractName: string,
  address: `0x${string}`,
  chainId?: number
): void {
  const network = getNetworkConfig(chainId);
  network.contracts[contractName] = address;
  
  console.log(`[Contract] 合约地址已更新：${contractName} -> ${address}`);
}

/**
 * 获取默认网络 ID
 * 
 * @returns 默认网络 ID
 */
export function getDefaultChainId(): number {
  return defaultChainId;
}

/**
 * 获取所有支持的网络
 * 
 * @returns 网络配置列表
 */
export function getSupportedNetworks(): NetworkConfig[] {
  return Object.values(networkConfigs);
}

/**
 * 检查网络是否支持
 * 
 * @param chainId 链 ID
 * @returns 是否支持
 */
export function isNetworkSupported(chainId: number): boolean {
  return chainId in networkConfigs;
}

/**
 * 导出合约地址配置
 */
export const contractConfig = {
  getNetworkConfig,
  getContractAddress,
  getAllContractAddresses,
  setContractAddress,
  getDefaultChainId,
  getSupportedNetworks,
  isNetworkSupported,
};

/**
 * 导出默认配置
 */
export default contractConfig;
