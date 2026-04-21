/**
 * wagmi 配置 - 已迁移至 @trustaid/wallet-sdk
 * 
 * 说明：
 * - wagmi 和 WalletConnect 已在 SSR 时产生 indexedDB 错误
 * - 现在使用 @trustaid/wallet-sdk 替代
 * - 此文件保留仅用于向后兼容
 */

// 为了向后兼容的空配置
export const wagmiConfig = undefined;
export const queryClient = undefined;

// 导出支持的链（用于显示）
export const SUPPORTED_CHAINS = [
  {
    id: 887766,
    name: 'Local Geth',
    rpcUrls: ['http://localhost:8545'],
  },
  {
    id: 1337,
    name: 'Localhost',
    rpcUrls: ['http://localhost:8545'],
  },
];

export const DEFAULT_CHAIN = SUPPORTED_CHAINS[0];

export function getChainInfo(chainId?: number) {
  if (!chainId) return DEFAULT_CHAIN;
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId) || DEFAULT_CHAIN;
}

export function getRpcUrl(chainId?: number): string {
  const chain = getChainInfo(chainId);
  return chain.rpcUrls[0];
}

// 空函数，保持接口兼容
export function createWagmiConfig() {
  console.warn('createWagmiConfig 已废弃，请使用 getWalletClient()');
  return undefined;
}

export function createQueryClient() {
  console.warn('createQueryClient 已废弃，wallet-sdk 不需要 React Query');
  return undefined;
}

// 延迟初始化，避免 SSR 错误
let _wagmiConfig: any = undefined;
let _queryClient: any = undefined;

export function getWagmiConfig() {
  if (!_wagmiConfig) {
    _wagmiConfig = createWagmiConfig();
  }
  return _wagmiConfig;
}

export function getQueryClient() {
  if (!_queryClient) {
    _queryClient = createQueryClient();
  }
  return _queryClient;
}
