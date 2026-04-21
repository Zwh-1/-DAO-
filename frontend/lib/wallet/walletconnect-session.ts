/**
 * WalletConnect v2（@walletconnect/ethereum-provider）会话。
 * 与 wallet-sdk 通过 EIP-1193 providerResolver 对接，避免引入 wagmi 连接层。
 */

import type { Eip1193Provider } from "@trustaid/wallet-sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: any = null;

function buildRpcMap(): Record<string, string> {
  return {
    "eip155:887766": "http://127.0.0.1:8545",
    "eip155:1337": "http://127.0.0.1:8545",
  };
}

/**
 * 初始化并连接 WalletConnect（弹出 QR / 深度链接），返回 EIP-1193 Provider。
 */
export async function openWalletConnectSession(projectId: string): Promise<Eip1193Provider> {
  const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");

  if (cached?.connected) {
    return cached as unknown as Eip1193Provider;
  }

  cached = await EthereumProvider.init({
    projectId,
    chains: [887766],
    optionalChains: [1337, 1, 137],
    showQrModal: true,
    rpcMap: buildRpcMap(),
  });

  if (!cached.connected) {
    await cached.connect();
  }

  return cached as unknown as Eip1193Provider;
}

/**
 * 断开 WalletConnect 会话并释放实例。
 */
export async function disconnectWalletConnectSession(): Promise<void> {
  if (!cached) return;
  try {
    await cached.disconnect();
  } catch {
    // ignore
  }
  cached = null;
}

/**
 * 是否已有已连接的 WC provider（用于避免重复弹窗）。
 */
export function isWalletConnectConnected(): boolean {
  return Boolean(cached?.connected);
}
