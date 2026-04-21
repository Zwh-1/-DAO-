import { resolveInjectedProvider } from "./adapters/browser";
import { WalletSdkError, WalletErrorCodes } from "./errors";
import { EmbeddedKeystore, createBrowserStorage } from "./keystore/keystore";
import { InjectedProviderClient } from "./provider/injected";
import type { ChainConfig, TxRequestV1, TypedDataPayload, WalletClientOptions, WalletEvent, WalletRuntime } from "./public/types";
import { resolveRuntime } from "./internal/runtime-resolver";
import { createInjectedService } from "./internal/injected-service";
import { createEmbeddedService } from "./internal/embedded-service";
import { attachInjectedEvents } from "./internal/event-bridge";

export type WalletClient = {
  getRuntimeInfo: () => { runtime: WalletRuntime };
  requestAccounts: () => Promise<string[]>;
  signMessage: (message: string, opts?: { password?: string }) => Promise<string>;
  signTypedData: (typedData: TypedDataPayload, opts?: { password?: string }) => Promise<string>;
  sendTransaction: (tx: TxRequestV1 | Record<string, unknown>, opts?: { password?: string; rpcUrl?: string }) => Promise<string>;
  switchChain: (chainIdHex: string) => Promise<void>;
  addChainThenSwitch: (chain: ChainConfig) => Promise<void>;
  createEmbeddedWallet: (password: string) => Promise<{ address: string; mnemonic: string }>;
  importEmbeddedMnemonic: (password: string, mnemonic: string) => Promise<string>;
  deriveNextEmbeddedAccount: (password: string) => Promise<string>;
  listEmbeddedAccounts: (password: string) => Promise<string[]>;
  selectEmbeddedAccount: (password: string, address: string) => Promise<void>;
  subscribe: (
    handlers: {
      onAccountsChanged?: (accounts: string[]) => void;
      onChainChanged?: (chainIdHex: string) => void;
      onDisconnect?: (error?: unknown) => void;
      onEvent?: (event: WalletEvent) => void;
    }
  ) => () => void;
};

function makeEmbedded(options: WalletClientOptions) {
  const key = options.storageKey || "trustaid_wallet_sdk_keystore";
  if (typeof window === "undefined") {
    throw new WalletSdkError(WalletErrorCodes.UNSUPPORTED_METHOD, "Browser wallet client is not available in Node runtime");
  }
  return new EmbeddedKeystore(createBrowserStorage(), key, { mnemonicMode: options.mnemonicMode || "mnemonic-persisted" });
}

export function createWalletClient(options: WalletClientOptions = {}): WalletClient {
  const mode = options.mode || "auto";
  const injected = new InjectedProviderClient(options.providerResolver?.() ?? resolveInjectedProvider());
  const embedded = makeEmbedded(options);
  const runtime: WalletRuntime = resolveRuntime(mode, injected.hasProvider());
  const injectedSvc = createInjectedService(injected);
  const embeddedSvc = createEmbeddedService(embedded, options);

  return {
    getRuntimeInfo() {
      return { runtime };
    },
    async requestAccounts() {
      if (runtime === "injected") return injectedSvc.requestAccounts();
      throw new WalletSdkError(WalletErrorCodes.PROVIDER_NOT_FOUND, "Embedded mode has no wallet popup to request accounts");
    },
    async signMessage(message, opts) {
      if (runtime === "injected") return injectedSvc.signMessage(message);
      return embeddedSvc.signMessage(message, opts);
    },
    async signTypedData(typedData, opts) {
      if (runtime === "injected") return injectedSvc.signTypedData(typedData);
      return embeddedSvc.signTypedData(typedData, opts);
    },
    async sendTransaction(tx, opts) {
      if (runtime === "injected") return injectedSvc.sendTransaction(tx);
      return embeddedSvc.sendTransaction(tx, opts);
    },
    async switchChain(chainIdHex) {
      if (runtime === "injected") return injectedSvc.switchChain(chainIdHex);
      return embeddedSvc.switchChain();
    },
    async addChainThenSwitch(chain) {
      if (runtime === "injected") return injectedSvc.addChainThenSwitch(chain);
      return embeddedSvc.addChainThenSwitch(chain);
    },
    async createEmbeddedWallet(password) {
      return embedded.create(password);
    },
    async importEmbeddedMnemonic(password, mnemonic) {
      return embedded.importMnemonic(password, mnemonic);
    },
    async deriveNextEmbeddedAccount(password) {
      return embedded.deriveNextAccount(password);
    },
    async listEmbeddedAccounts(password) {
      return embedded.listAccounts(password);
    },
    async selectEmbeddedAccount(password, address) {
      return embedded.selectAccount(password, address);
    },
    subscribe(handlers) {
      if (runtime !== "injected") return () => {};
      return attachInjectedEvents(injected, handlers);
    }
  };
}
