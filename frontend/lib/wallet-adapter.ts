import { createWalletClient, WalletSdkError, WalletErrorCodes } from "@trustaid/wallet-sdk";
import { useAuthStore } from "../store/authStore";

let singleton: ReturnType<typeof createWalletClient> | null = null;
let unsubscribed = false;
let currentMode: "auto" | "injected" | "embedded" = "auto";

/** 显式切换钱包模式（injected = MetaMask 等注入型；embedded = 本地内置钱包）。
 *  调用后会销毁旧单例，下次 getWalletClient() 时按新模式重建。 */
export function setWalletMode(mode: "auto" | "injected" | "embedded") {
  currentMode = mode;
  singleton = null;
  unsubscribed = false;
}

/** 返回当前用户选择的钱包接入模式 */
export function getWalletMode() {
  return currentMode;
}

type EmbeddedRuntimeConfig = {
  password?: string;
  rpcUrl?: string;
};

let embeddedConfig: EmbeddedRuntimeConfig = {};
const txHistory = new Map<string, { txHash: string; status: "submitted" | "confirmed" | "failed"; chainIdHex?: string; updatedAt: number }>();

export type WalletApprovalIntent = {
  action: "signMessage" | "signTypedData" | "sendTransaction";
  payload: Record<string, unknown>;
};

let approvalHandler: ((intent: WalletApprovalIntent) => Promise<boolean>) | null = null;

export function setWalletApprovalHandler(handler: ((intent: WalletApprovalIntent) => Promise<boolean>) | null) {
  approvalHandler = handler;
}

async function requireApproval(intent: WalletApprovalIntent) {
  useAuthStore.getState().setWalletSessionState("pendingApproval");
  if (!approvalHandler) return;
  const allowed = await approvalHandler(intent);
  if (!allowed) {
    useAuthStore.getState().setWalletSessionState("failed");
    throw new WalletSdkError(WalletErrorCodes.USER_REJECTED, "用户拒绝钱包授权");
  }
}

export function setEmbeddedWalletConfig(input: EmbeddedRuntimeConfig) {
  embeddedConfig = { ...embeddedConfig, ...input };
}

export function getWalletClient() {
  if (!singleton) {
    singleton = createWalletClient({ mode: currentMode, storageKey: "trustaid_wallet_sdk" });
    const runtime = singleton.getRuntimeInfo().runtime;
    useAuthStore.getState().setWalletRuntime(runtime);
    if (!unsubscribed) {
      singleton.subscribe({
        onAccountsChanged: (accounts) => {
          const primary = String(accounts[0] || "").toLowerCase();
          if (primary) useAuthStore.setState({ address: primary });
        },
        onChainChanged: (chainIdHex) => {
          useAuthStore.getState().setWalletChainId(chainIdHex);
        },
        onDisconnect: () => {
          useAuthStore.getState().setWalletSessionState("locked");
        }
      });
      unsubscribed = true;
    }
  }
  return singleton;
}

export async function requestPrimaryAccount(): Promise<string> {
  const client = getWalletClient();
  try {
    const accounts = await client.requestAccounts();
    const addr = String(accounts[0] || "");
    if (!addr) throw new Error("未取得地址");
    useAuthStore.getState().setWalletSessionState("unlocked");
    return addr;
  } catch {
    if (!embeddedConfig.password) throw new Error("未取得地址，embedded 模式请先提供钱包密码");
    const accounts = await client.listEmbeddedAccounts(embeddedConfig.password);
    const addr = String(accounts[0] || "");
    if (!addr) throw new Error("embedded 钱包不存在账户，请先创建或导入");
    useAuthStore.getState().setWalletSessionState("unlocked");
    return addr;
  }
}

export async function signSiweMessage(message: string): Promise<string> {
  const client = getWalletClient();
  try {
    await requireApproval({ action: "signMessage", payload: { messagePreview: message.slice(0, 64) } });
    useAuthStore.getState().setWalletSessionState("signing");
    const res = await client.signMessage(message, embeddedConfig.password ? { password: embeddedConfig.password } : undefined);
    useAuthStore.getState().setWalletSessionState("unlocked");
    return res;
  } catch (e) {
    useAuthStore.getState().setWalletSessionState("failed");
    throw mapWalletError(e);
  }
}

export function walletRuntime() {
  return getWalletClient().getRuntimeInfo().runtime;
}

export async function walletSendTransaction(tx: Record<string, unknown>) {
  const client = getWalletClient();
  try {
    await requireApproval({ action: "sendTransaction", payload: tx });
    useAuthStore.getState().setWalletSessionState("signing");
    const txHash = await client.sendTransaction(
      tx,
      embeddedConfig.password
        ? { password: embeddedConfig.password, rpcUrl: embeddedConfig.rpcUrl }
        : undefined
    );
    useAuthStore.getState().setWalletSessionState("submitted");
    txHistory.set(txHash, { txHash, status: "submitted", updatedAt: Date.now() });
    return txHash;
  } catch (e) {
    useAuthStore.getState().setWalletSessionState("failed");
    throw mapWalletError(e);
  }
}

export async function walletSignTypedData(typedData: {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
}) {
  const client = getWalletClient();
  try {
    await requireApproval({ action: "signTypedData", payload: typedData.message || {} });
    useAuthStore.getState().setWalletSessionState("signing");
    const sig = await client.signTypedData(typedData, embeddedConfig.password ? { password: embeddedConfig.password } : undefined);
    useAuthStore.getState().setWalletSessionState("unlocked");
    return sig;
  } catch (e) {
    useAuthStore.getState().setWalletSessionState("failed");
    throw mapWalletError(e);
  }
}

export async function walletSwitchChain(chainIdHex: string) {
  const client = getWalletClient();
  try {
    await client.addChainThenSwitch({
      chainId: chainIdHex,
      chainName: `Chain ${chainIdHex}`,
      rpcUrls: [embeddedConfig.rpcUrl || "http://127.0.0.1:8545"],
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
    });
    useAuthStore.getState().setWalletChainId(chainIdHex);
  } catch (e) {
    throw mapWalletError(e);
  }
}

export async function createOrImportEmbeddedWallet(input: { password: string; mnemonic?: string }) {
  const client = getWalletClient();
  setEmbeddedWalletConfig({ password: input.password });
  const address = input.mnemonic
    ? await client.importEmbeddedMnemonic(input.password, input.mnemonic)
    : await client.createEmbeddedWallet(input.password);
  useAuthStore.getState().setWalletSessionState("unlocked");
  return address;
}

export async function deriveNextEmbeddedAccount(password: string) {
  const client = getWalletClient();
  return client.deriveNextEmbeddedAccount(password);
}

export async function selectEmbeddedAccount(password: string, address: string) {
  const client = getWalletClient();
  await client.selectEmbeddedAccount(password, address);
}

export function getWalletTxHistory() {
  return Array.from(txHistory.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function waitForTxReceipt(txHash: string, input?: { rpcUrl?: string; timeoutMs?: number }) {
  const { JsonRpcProvider } = await import("ethers");
  const rpcUrl = input?.rpcUrl || embeddedConfig.rpcUrl;
  if (!rpcUrl) return null;
  const provider = new JsonRpcProvider(rpcUrl);
  const receipt = await provider.waitForTransaction(txHash, 1, input?.timeoutMs || 120000);
  const history = txHistory.get(txHash);
  txHistory.set(txHash, {
    txHash,
    status: receipt ? "confirmed" : "failed",
    chainIdHex: history?.chainIdHex,
    updatedAt: Date.now()
  });
  useAuthStore.getState().setWalletSessionState(receipt ? "unlocked" : "failed");
  return receipt;
}

export type WalletUiErrorCode =
  | "WALLET_NOT_FOUND"
  | "INVALID_PASSWORD"
  | "UNSUPPORTED_METHOD"
  | "USER_REJECTED"
  | "CHAIN_NOT_ADDED"
  | "CHAIN_SWITCH_REJECTED"
  | "INVALID_PARAMS"
  | "TX_FAILED"
  | "UNKNOWN";

export type WalletUiError = Error & { uiCode: WalletUiErrorCode };

export function mapWalletError(input: unknown): WalletUiError {
  const err = input as { code?: string | number; message?: string };
  const e = new Error(err?.message || "钱包操作失败") as WalletUiError;
  e.uiCode = "UNKNOWN";

  if (input instanceof WalletSdkError) {
    if (input.code === WalletErrorCodes.PROVIDER_NOT_FOUND) e.uiCode = "WALLET_NOT_FOUND";
    else if (input.code === WalletErrorCodes.INVALID_PASSWORD) e.uiCode = "INVALID_PASSWORD";
    else if (input.code === WalletErrorCodes.UNSUPPORTED_METHOD) e.uiCode = "UNSUPPORTED_METHOD";
    else if (input.code === WalletErrorCodes.USER_REJECTED) e.uiCode = "USER_REJECTED";
    else if (input.code === WalletErrorCodes.CHAIN_NOT_ADDED) e.uiCode = "CHAIN_NOT_ADDED";
    else if (input.code === WalletErrorCodes.CHAIN_SWITCH_REJECTED) e.uiCode = "CHAIN_SWITCH_REJECTED";
    else if (input.code === WalletErrorCodes.INVALID_PARAMS) e.uiCode = "INVALID_PARAMS";
    else if (input.code === WalletErrorCodes.TRANSACTION_FAILED) e.uiCode = "TX_FAILED";
    return e;
  }

  if (err?.code === 4001) e.uiCode = "USER_REJECTED";
  else if (err?.code === 4902) e.uiCode = "CHAIN_NOT_ADDED";
  else if (err?.code === -32602) e.uiCode = "INVALID_PARAMS";

  return e;
}
