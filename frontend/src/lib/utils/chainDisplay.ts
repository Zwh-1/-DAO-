/**
 * 链 ID 展示名（常用测试网/本地）
 */

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum 主网',
  11155111: 'Sepolia',
  17000: 'Holesky',
  5: 'Goerli',
  31337: 'Hardhat / Anvil 本地',
  1337: '本地开发',
};

export function getChainDisplayName(chainId: number | null | undefined): string {
  if (chainId == null) return '—';
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}
