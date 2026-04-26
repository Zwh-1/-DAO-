/**
 * 钱包适配器 - 基于 @trustaid/wallet-sdk
 * 
 * 功能：
 * - 统一管理钱包客户端
 * - 提供连接/断开/签名/交易等方法
 * - 错误映射与重试机制
 * - 交易历史记录
 * 
 * 隐私保护：
 * - 私钥永不出端
 * - 敏感操作需用户确认
 * - 日志地址脱敏
 */

import { createWalletClient, WalletSdkError, WalletErrorCodes } from "@trustaid/wallet-sdk";
import type { Eip1193Provider } from "@trustaid/wallet-sdk";
import { useAuthStore } from "@/store/authStore";
import { getDefaultRpcUrlForChain, getNetworkByChainId } from "./networks";
import { formatAddress as formatAddressUtil } from "@/lib/utils/format";

// ==================== 单例管理 ====================

let singleton: ReturnType<typeof createWalletClient> | null = null;
let unsubscribed = false;
let currentMode: "auto" | "injected" | "embedded" = "auto";
let isInitializing = false; // 防止重复初始化

/** 自定义 EIP-1193（如 WalletConnect）；为 null 时使用 window.ethereum */
let customProviderResolver: (() => Eip1193Provider | null) | null = null;

/**
 * 注入自定义 EIP-1193 Provider（WalletConnect 等）。会重置钱包单例。
 */
export function setWalletProviderResolver(resolver: (() => Eip1193Provider | null) | null) {
  customProviderResolver = resolver;
  singleton = null;
  unsubscribed = false;
  isInitializing = false;
}

/**
 * 断开 WalletConnect 并清除自定义 Provider，恢复浏览器注入钱包路径。
 */
export async function resetExternalWalletProvider(): Promise<void> {
  customProviderResolver = null;
  singleton = null;
  unsubscribed = false;
  isInitializing = false;
  const { disconnectWalletConnectSession } = await import("./walletconnect-session");
  await disconnectWalletConnectSession();
}

/**
 * 显式切换钱包模式
 * @param mode - "auto": 自动选择 | "injected": 注入钱包 | "embedded": 内置钱包
 */
export function setWalletMode(mode: "auto" | "injected" | "embedded") {
  currentMode = mode;
  singleton = null;
  unsubscribed = false;
  isInitializing = false;
}

/**
 * 返回当前钱包模式
 */
export function getWalletMode(): "auto" | "injected" | "embedded" {
  return currentMode;
}

// ==================== 配置管理 ====================

type EmbeddedRuntimeConfig = {
  password?: string;
  rpcUrl?: string;
  /** 当前选择的链（十进制），与 UI NetworkSwitcher 一致 */
  chainId?: number;
};

let embeddedConfig: EmbeddedRuntimeConfig = {};

/**
 * 设置内置钱包配置
 * @param input - 配置对象
 */
export function setEmbeddedWalletConfig(input: EmbeddedRuntimeConfig) {
  embeddedConfig = { ...embeddedConfig, ...input };
}

// ==================== 交易历史 ====================

type TxStatus = "submitted" | "confirmed" | "failed";

interface TxRecord {
  txHash: string;
  status: TxStatus;
  chainIdHex?: string;
  updatedAt: number;
  blockNumber?: number;
  from?: string;
  to?: string;
  value?: string;
}

const txHistory = new Map<string, TxRecord>();

/**
 * 获取交易历史记录
 * @returns 按时间倒序的交易记录数组
 */
export function getWalletTxHistory(): TxRecord[] {
  return Array.from(txHistory.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 更新交易记录
 */
function updateTxRecord(txHash: string, updates: Partial<TxRecord>) {
  const existing = txHistory.get(txHash);
  if (existing) {
    txHistory.set(txHash, { ...existing, ...updates, updatedAt: Date.now() });
  }
}

// ==================== 审批处理器 ====================

export type WalletApprovalIntent = {
  action: "signMessage" | "signTypedData" | "sendTransaction";
  payload: Record<string, unknown>;
};

let approvalHandler: ((intent: WalletApprovalIntent) => Promise<boolean>) | null = null;

/**
 * 设置钱包审批处理器
 * @param handler - 审批处理函数
 */
export function setWalletApprovalHandler(handler: ((intent: WalletApprovalIntent) => Promise<boolean>) | null) {
  approvalHandler = handler;
}

/**
 * 请求用户审批
 * @param intent - 审批意图
 */
async function requireApproval(intent: WalletApprovalIntent): Promise<void> {
  useAuthStore.getState().setWalletSessionState("pendingApproval");
  if (!approvalHandler) return;
  const allowed = await approvalHandler(intent);
  if (!allowed) {
    useAuthStore.getState().setWalletSessionState("failed");
    throw new WalletSdkError(WalletErrorCodes.USER_REJECTED, "用户拒绝钱包授权");
  }
}

// ==================== 钱包客户端管理 ====================

/**
 * 获取或创建钱包客户端单例
 * @returns 钱包客户端实例
 */
export function getWalletClient() {
  if (singleton) return singleton;
  if (isInitializing) {
    console.warn('[Wallet] 正在初始化中，请稍候...');
    return null;
  }

  isInitializing = true;
  
  try {
    // providerResolver：返回 null 时 SDK 回退到 resolveInjectedProvider()（MetaMask 等）
    singleton = createWalletClient({
      mode: currentMode,
      storageKey: "trustaid_wallet_sdk",
      mnemonicMode: "mnemonic-persisted",
      providerResolver: () => customProviderResolver?.() ?? null,
    });
    
    const runtime = singleton.getRuntimeInfo().runtime;
    useAuthStore.getState().setWalletRuntime(runtime);
    
    // 订阅钱包事件（唯一注册点；useWallet 不再重复 subscribe）
    if (!unsubscribed) {
      singleton.subscribe({
        onAccountsChanged: (accounts) => {
          const primary = String(accounts[0] || "").toLowerCase();
          if (primary) {
            useAuthStore.setState({ address: primary });
            console.log("[Wallet] 账户已切换:", formatAddress(primary));
          } else {
            useAuthStore.getState().setAddress(null);
            useAuthStore.getState().setWalletSessionState("disconnected");
          }
        },
        onChainChanged: (chainIdHex) => {
          useAuthStore.getState().setWalletChainId(chainIdHex);
          console.log("[Wallet] 网络已切换:", chainIdHex);
        },
        onDisconnect: (error) => {
          console.warn("[Wallet] 钱包已断开:", error);
          useAuthStore.getState().setWalletSessionState("locked");
          useAuthStore.getState().setAddress(null);
          useAuthStore.getState().setWalletChainId(null);
        },
      });
      unsubscribed = true;
    }
    
    console.log('[Wallet] 客户端初始化成功，模式:', runtime);
    return singleton;
  } catch (error) {
    console.error('[Wallet] 初始化失败:', error);
    singleton = null;
    isInitializing = false;
    throw error;
  } finally {
    isInitializing = false;
  }
}

// ==================== 账户管理 ====================

/**
 * 请求主账户（优先弹出钱包选择器）
 * @returns 钱包地址
 */
export async function requestPrimaryAccount(): Promise<string> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  
  try {
    // 优先尝试请求账户（会弹出钱包选择器）
    const accounts = await client.requestAccounts();
    const addr = String(accounts[0] || "");
    if (!addr) throw new Error("未取得地址");
    
    useAuthStore.getState().setWalletSessionState("unlocked");
    console.log('[Wallet] 已连接:', formatAddress(addr));
    return addr;
  } catch (error) {
    // 如果是 injected 模式失败，尝试 embedded 模式
    if (currentMode !== "injected" && embeddedConfig.password) {
      const accounts = await client.listEmbeddedAccounts(embeddedConfig.password);
      const addr = String(accounts[0] || "");
      if (!addr) throw new Error("embedded 钱包不存在账户，请先创建或导入");
      
      useAuthStore.getState().setWalletSessionState("unlocked");
      console.log('[Wallet] 已连接 (embedded):', formatAddress(addr));
      return addr;
    }
    
    throw error;
  }
}

/**
 * 列出所有账户（仅 embedded 模式）
 * @param password - 钱包密码
 * @returns 账户地址数组
 */
export async function listEmbeddedAccounts(password: string): Promise<string[]> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  return client.listEmbeddedAccounts(password);
}

/**
 * 选择指定账户（仅 embedded 模式）
 * @param password - 钱包密码
 * @param address - 账户地址
 */
export async function selectEmbeddedAccount(password: string, address: string): Promise<void> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  await client.selectEmbeddedAccount(password, address);
  useAuthStore.getState().setAddress(address.toLowerCase());
}

/** 新建钱包时附带助记词（仅用于 UI 展示一次）；导入则无 */
export type CreateOrImportEmbeddedResult =
  | { mode: "create"; address: string; mnemonic: string }
  | { mode: "import"; address: string };

/**
 * 创建或导入内置钱包
 * @param input - 密码和可选的助记词
 */
export async function createOrImportEmbeddedWallet(input: { password: string; mnemonic?: string }): Promise<CreateOrImportEmbeddedResult> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");

  setEmbeddedWalletConfig({ password: input.password });

  if (input.mnemonic?.trim()) {
    const address = await client.importEmbeddedMnemonic(input.password, input.mnemonic.trim());
    useAuthStore.getState().setWalletSessionState("unlocked");
    console.log("[Wallet] 导入成功:", formatAddress(address));
    return { mode: "import", address };
  }

  // SDK 实际返回 { address, mnemonic }；node_modules 中 d.ts 可能滞后于源码构建，经 unknown 断言
  const { address, mnemonic } = (await client.createEmbeddedWallet(input.password)) as unknown as {
    address: string;
    mnemonic: string;
  };
  useAuthStore.getState().setWalletSessionState("unlocked");
  console.log("[Wallet] 创建成功:", formatAddress(address));
  return { mode: "create", address, mnemonic };
}

/**
 * 派生下一个账户（仅 embedded 模式）
 * @param password - 钱包密码
 * @returns 新派生的账户地址
 */
export async function deriveNextEmbeddedAccount(password: string): Promise<string> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  return client.deriveNextEmbeddedAccount(password);
}

/**
 * 切换区块链网络
 * @param chainId - 目标链 ID（十进制）
 */
export async function switchNetwork(chainId: number): Promise<void> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");

  const chainIdHex = `0x${chainId.toString(16)}`;
  const runtime = client.getRuntimeInfo().runtime;

  // Embedded：无 EIP-1193 切链，仅更新本地 RPC + store（与 NetworkSwitcher 配置一致）
  if (runtime === "embedded") {
    const rpc =
      getDefaultRpcUrlForChain(chainId) ?? embeddedConfig.rpcUrl ?? "http://127.0.0.1:8545";
    embeddedConfig = { ...embeddedConfig, chainId, rpcUrl: rpc };
    useAuthStore.getState().setWalletChainId(chainIdHex);
    console.log("[Wallet] embedded 网络（配置）已更新:", chainIdHex, rpc);
    return;
  }

  const net = getNetworkByChainId(chainId);
  const rpcUrl = net?.rpcUrl ?? embeddedConfig.rpcUrl ?? 'http://127.0.0.1:8545';

  try {
    await client.switchChain(chainIdHex);
    useAuthStore.getState().setWalletChainId(chainIdHex);
    console.log("[Wallet] 网络已切换:", chainIdHex);
  } catch (error) {
    const code = (error as { code?: number | string })?.code;
    // EIP-4902: chain not yet in MetaMask — add it, then switch
    if (code === 4902 || String(code) === 'CHAIN_NOT_ADDED') {
      try {
        await client.addChainThenSwitch({
          chainId:          chainIdHex,
          chainName:        net?.name ?? `Chain ${chainIdHex}`,
          rpcUrls:          [rpcUrl],
          nativeCurrency:   { name: 'ETH', symbol: 'ETH', decimals: 18 },
        });
        useAuthStore.getState().setWalletChainId(chainIdHex);
        console.log("[Wallet] 链已添加并切换:", chainIdHex);
        return;
      } catch (addErr) {
        console.error("[Wallet] 添加链失败:", addErr);
        throw addErr;
      }
    }
    console.error("[Wallet] 切换网络失败:", error);
    throw error;
  }
}

// ==================== 签名操作 ====================

/**
 * 签名 SIWE 消息
 * @param message - 待签名的消息
 * @returns 签名结果
 */
export async function signSiweMessage(message: string): Promise<string> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  
  try {
    await requireApproval({ action: "signMessage", payload: { messagePreview: message.slice(0, 64) } });
    // 签名中：使用 pendingApproval 状态
    useAuthStore.getState().setWalletSessionState("pendingApproval");
    
    const res = await client.signMessage(
      message, 
      embeddedConfig.password ? { password: embeddedConfig.password } : undefined
    );
    
    useAuthStore.getState().setWalletSessionState("unlocked");
    console.log('[Wallet] 签名成功');
    return res;
  } catch (error) {
    useAuthStore.getState().setWalletSessionState("failed");
    console.error('[Wallet] 签名失败:', error);
    throw mapWalletError(error);
  }
}

/**
 * 签名类型化数据（EIP-712）
 * @param typedData - 类型化数据
 * @returns 签名结果
 */
export async function walletSignTypedData(typedData: {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
}): Promise<string> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  
  try {
    await requireApproval({ action: "signTypedData", payload: typedData.message || {} });
    // 签名中：使用 pendingApproval 状态
    useAuthStore.getState().setWalletSessionState("pendingApproval");
    
    const sig = await client.signTypedData(
      typedData,
      embeddedConfig.password ? { password: embeddedConfig.password } : undefined
    );
    
    useAuthStore.getState().setWalletSessionState("unlocked");
    console.log('[Wallet] 类型化签名成功');
    return sig;
  } catch (error) {
    useAuthStore.getState().setWalletSessionState("failed");
    console.error('[Wallet] 类型化签名失败:', error);
    throw mapWalletError(error);
  }
}

// ==================== 交易操作 ====================

/**
 * 发送交易
 * @param tx - 交易对象
 * @returns 交易哈希
 */
export async function walletSendTransaction(tx: Record<string, unknown>): Promise<string> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");

  const { walletRuntime } = useAuthStore.getState();

  try {
    let txHash: string;

    if (walletRuntime === 'injected') {
      // SDK 内部 normalizeTxRequest 会丢弃 `from` 字段，导致 MetaMask 报
      // "Invalid parameters: must provide an Ethereum address"。
      // 注入模式下直接调用 window.ethereum.request，保留 from。
      const eth = (window as unknown as { ethereum?: { request: (p: { method: string; params: unknown[] }) => Promise<string> } }).ethereum;
      if (!eth) throw new Error("MetaMask 未找到，请安装 MetaMask 插件");
      txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  String(tx.from ?? ''),
          to:    String(tx.to ?? ''),
          data:  tx.data  ? String(tx.data)  : undefined,
          value: '0x0',
        }],
      });
    } else {
      // embedded 模式：先弹出内置确认框，用户确认后再执行
      await requireApproval({ action: "sendTransaction", payload: tx });
      useAuthStore.getState().setWalletSessionState("pendingApproval");
      txHash = await client.sendTransaction(
        tx,
        embeddedConfig.password
          ? { password: embeddedConfig.password, rpcUrl: embeddedConfig.rpcUrl }
          : undefined
      ) as string;
    }
    
    // 交易已提交：使用 unlocked 状态（等待链上确认）
    useAuthStore.getState().setWalletSessionState("unlocked");
    
    // 记录交易历史
    txHistory.set(txHash, {
      txHash,
      status: "submitted",
      updatedAt: Date.now(),
      from: String(tx.from || ""),
      to: String(tx.to || ""),
      value: String(tx.value || "0"),
    });
    
    console.log('[Wallet] 交易已发送:', txHash);
    return txHash;
  } catch (error) {
    useAuthStore.getState().setWalletSessionState("failed");
    console.error('[Wallet] 交易失败:', error);
    throw mapWalletError(error);
  }
}

/**
 * 等待交易回执
 * @param txHash - 交易哈希
 * @param input - 可选配置
 * @returns 交易回执
 */
export async function waitForTxReceipt(
  txHash: string, 
  input?: { rpcUrl?: string; timeoutMs?: number }
): Promise<unknown> {
  const { JsonRpcProvider } = await import("ethers");
  const rpcUrl = input?.rpcUrl || embeddedConfig.rpcUrl;
  
  if (!rpcUrl) {
    console.warn('[Wallet] 缺少 RPC URL，无法等待回执');
    return null;
  }
  
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const receipt = await provider.waitForTransaction(txHash, 1, input?.timeoutMs || 120000);
    
    // 更新交易记录
    updateTxRecord(txHash, {
      status: receipt ? "confirmed" : "failed",
      blockNumber: receipt?.blockNumber,
    });
    
    useAuthStore.getState().setWalletSessionState(receipt ? "unlocked" : "failed");
    console.log('[Wallet] 交易确认:', receipt ? '成功' : '失败');
    return receipt;
  } catch (error) {
    console.error('[Wallet] 等待回执失败:', error);
    updateTxRecord(txHash, { status: "failed" });
    throw error;
  }
}

// ==================== 网络切换 ====================

/**
 * 切换链
 * @param chainIdHex - 链 ID（十六进制）
 */
export async function walletSwitchChain(chainIdHex: string): Promise<void> {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");

  const runtime = client.getRuntimeInfo().runtime;
  if (runtime === "embedded") {
    const n = parseInt(chainIdHex, 16);
    if (Number.isNaN(n)) throw new Error("无效的 chainId");
    await switchNetwork(n);
    return;
  }

  const chainIdNum = parseInt(chainIdHex, 16);
  const rpcUrl =
    getNetworkByChainId(chainIdNum)?.rpcUrl ??
    embeddedConfig.rpcUrl ??
    "http://127.0.0.1:8545";

  try {
    await client.addChainThenSwitch({
      chainId: chainIdHex,
      chainName: getNetworkByChainId(chainIdNum)?.name ?? `Chain ${chainIdHex}`,
      rpcUrls: [rpcUrl],
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    });

    useAuthStore.getState().setWalletChainId(chainIdHex);
    console.log("[Wallet] 网络已切换:", chainIdHex);
  } catch (error) {
    console.error("[Wallet] 切换网络失败:", error);
    throw mapWalletError(error);
  }
}

/**
 * 获取当前运行时信息
 */
export function walletRuntime() {
  const client = getWalletClient();
  if (!client) throw new Error("钱包客户端未初始化");
  return client.getRuntimeInfo().runtime;
}

// ==================== 错误处理 ====================

export type WalletUiErrorCode =
  | "WALLET_NOT_FOUND"
  | "INVALID_PASSWORD"
  | "UNSUPPORTED_METHOD"
  | "USER_REJECTED"
  | "CHAIN_NOT_ADDED"
  | "CHAIN_SWITCH_REJECTED"
  | "INVALID_PARAMS"
  | "TX_FAILED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export type WalletUiError = Error & { 
  uiCode: WalletUiErrorCode;
  originalError?: unknown;
};

/**
 * 将钱包错误映射为 UI 友好的错误码
 * @param input - 原始错误
 * @returns UI 友好的错误对象
 */
export function mapWalletError(input: unknown): WalletUiError {
  const err = input as { code?: string | number; message?: string };
  const e = new Error(err?.message || "钱包操作失败") as WalletUiError;
  e.uiCode = "UNKNOWN";
  e.originalError = input;

  if (input instanceof WalletSdkError) {
    const code = input.code;
    if (code === WalletErrorCodes.PROVIDER_NOT_FOUND) e.uiCode = "WALLET_NOT_FOUND";
    else if (code === WalletErrorCodes.INVALID_PASSWORD) e.uiCode = "INVALID_PASSWORD";
    else if (code === WalletErrorCodes.UNSUPPORTED_METHOD) e.uiCode = "UNSUPPORTED_METHOD";
    else if (code === WalletErrorCodes.USER_REJECTED) e.uiCode = "USER_REJECTED";
    else if (code === WalletErrorCodes.CHAIN_NOT_ADDED) e.uiCode = "CHAIN_NOT_ADDED";
    else if (code === WalletErrorCodes.CHAIN_SWITCH_REJECTED) e.uiCode = "CHAIN_SWITCH_REJECTED";
    else if (code === WalletErrorCodes.INVALID_PARAMS) e.uiCode = "INVALID_PARAMS";
    else if (code === WalletErrorCodes.TRANSACTION_FAILED) e.uiCode = "TX_FAILED";
    return e;
  }

  // ethers/viem 错误码映射
  if (err?.code === 4001) e.uiCode = "USER_REJECTED";
  else if (err?.code === 4902) e.uiCode = "CHAIN_NOT_ADDED";
  else if (err?.code === -32602) e.uiCode = "INVALID_PARAMS";
  else if (err?.message?.includes("timeout")) e.uiCode = "TIMEOUT";
  else if (err?.message?.includes("network")) e.uiCode = "NETWORK_ERROR";

  return e;
}

/**
 * 判断错误是否为用户拒绝
 * @param error - 错误对象
 * @returns 是否为用户拒绝
 */
export function isUserRejected(error: unknown): boolean {
  const mapped = mapWalletError(error);
  return mapped.uiCode === "USER_REJECTED";
}

/**
 * 判断错误是否为网络错误
 * @param error - 错误对象
 * @returns 是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  const mapped = mapWalletError(error);
  return mapped.uiCode === "NETWORK_ERROR" || mapped.uiCode === "TIMEOUT";
}

// ==================== 工具函数 ====================

/**
 * 钱包地址格式化（脱敏展示）
 * @param address - 钱包地址
 * @returns 格式化后的地址
 */
export function formatAddress(address: string | null): string {
  return formatAddressUtil(address);
}

/**
 * 钱包地址完整展示（仅用于调试）
 * @warning 生产环境禁止使用此函数
 */
export function formatAddressFull(address: string | null): string {
  if (!address) return '未连接';
  console.warn('[Security] formatAddressFull 仅用于调试，生产环境禁用');
  return address;
}

/**
 * 断开钱包连接
 */
export async function disconnectWallet(): Promise<void> {
  try {
    if (useAuthStore.getState().walletConnector === "walletconnect") {
      await resetExternalWalletProvider();
    }

    // injected 模式无法断开链上会话，只能清除本地状态
    if (currentMode === "embedded") {
      useAuthStore.getState().setWalletSessionState("locked");
    }

    useAuthStore.getState().setWalletConnector(null);
    useAuthStore.getState().setAddress(null);
    console.log("[Wallet] 已断开连接");
  } catch (error) {
    console.error("[Wallet] 断开失败:", error);
  }
}
