/**
 * 与 NetworkSwitcher / wallet-adapter 共用的链配置，避免 RPC 与切链逻辑漂移。
 */

export type NetworkInfo = {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl?: string;
  color: string;
  isTestnet?: boolean;
};

export const SUPPORTED_NETWORKS: NetworkInfo[] = [
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: "https://mainnet.infura.io",
    explorerUrl: "https://etherscan.io",
    color: "#0A2540",
    isTestnet: false,
  },
  {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    color: "#10B981",
    isTestnet: false,
  },
  {
    chainId: 887766,
    name: "Medical Testnet",
    rpcUrl: "http://127.0.0.1:8545",
    color: "#0A2540",
    isTestnet: true,
  },
  {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    color: "#64748B",
    isTestnet: true,
  },
];

export function getNetworkByChainId(chainId: number): NetworkInfo | undefined {
  return SUPPORTED_NETWORKS.find((n) => n.chainId === chainId);
}

export function getDefaultRpcUrlForChain(chainId: number): string | undefined {
  return getNetworkByChainId(chainId)?.rpcUrl;
}
