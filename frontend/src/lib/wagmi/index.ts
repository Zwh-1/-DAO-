/**
 * wagmi 模块 - 已迁移至 @trustaid/wallet-sdk
 * 
 * 导出内容：
 * - Provider 组件
 * - 配置
 * - Hooks
 * - 工具函数
 */

// Provider 组件（使用 wallet-sdk 实现；WagmiProvider 为旧别名）
export {
  Providers as WalletRootProvider,
  Providers as WagmiProvider,
  default as Providers,
} from './Provider';

// 配置（向后兼容）
export {
  getWagmiConfig,
  getQueryClient,
  wagmiConfig,
  queryClient,
  SUPPORTED_CHAINS,
  DEFAULT_CHAIN,
  getChainInfo,
  getRpcUrl,
  createWagmiConfig,
  createQueryClient,
} from './config';

// viem 工具函数（保留，因为这些是纯函数）
export { parseEther, formatEther, parseUnits, formatUnits } from 'viem';
export { keccak256, toHex, toBytes, stringToBytes } from 'viem';
