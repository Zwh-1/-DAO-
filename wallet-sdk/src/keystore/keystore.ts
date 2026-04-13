import { HDNodeWallet, JsonRpcProvider, Wallet } from "ethers";
import { decryptJson, encryptJson } from "./crypto";
import { WalletSdkError, WalletErrorCodes } from "../errors";
import type { KeystorePayload, TxRequestV1, WalletRecord } from "../public/types";
import { mapWalletError } from "../internal/error-mapper";

type EmbeddedState = {
  accounts: WalletRecord[];
  selectedAddress: string | null;
  mnemonic?: string | null;
  nextAccountIndex?: number;
};

type EmbeddedKeystoreShape = {
  version: number;
  encrypted: KeystorePayload;
};

type StorageLike = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
};

export function createBrowserStorage(): StorageLike {
  return {
    async read(key) {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    },
    async write(key, value) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    }
  };
}

export class EmbeddedKeystore {
  constructor(
    private readonly storage: StorageLike,
    private readonly storageKey: string,
    private readonly options?: { mnemonicMode?: "mnemonic-persisted" | "mnemonic-ephemeral" }
  ) {}

  private async readEnvelope(): Promise<EmbeddedKeystoreShape | null> {
    const raw = await this.storage.read(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EmbeddedKeystoreShape;
    } catch (e) {
      throw mapWalletError(e, WalletErrorCodes.STORAGE_CORRUPTED, "Keystore envelope is corrupted");
    }
  }

  private async loadStateDecrypted(password: string): Promise<EmbeddedState> {
    const env = await this.readEnvelope();
    if (!env) throw new WalletSdkError(WalletErrorCodes.WALLET_NOT_FOUND, "Embedded wallet not found");
    return decryptJson<EmbeddedState>(env.encrypted, password);
  }

  private async saveStateEncrypted(password: string, state: EmbeddedState): Promise<void> {
    const encrypted = await encryptJson(state, password);
    await this.storage.write(this.storageKey, JSON.stringify({ version: 1, encrypted }));
  }

  private getSelectedAccountOrThrow(state: EmbeddedState): WalletRecord {
    const selected = state.accounts.find((a) => a.address === state.selectedAddress) || state.accounts[0];
    if (!selected) throw new WalletSdkError(WalletErrorCodes.WALLET_NOT_FOUND, "No account in keystore");
    return selected;
  }

  private getMnemonicForDerive(state: EmbeddedState): string {
    const phrase = state.mnemonic;
    if (!phrase) {
      throw new WalletSdkError(WalletErrorCodes.UNSUPPORTED_METHOD, "Mnemonic is not available in current keystore");
    }
    return phrase;
  }

  async create(password: string): Promise<string> {
    const wallet = HDNodeWallet.createRandom();
    const mnemonic = wallet.mnemonic?.phrase || null;
    const state: EmbeddedState = {
      accounts: [{ address: wallet.address, privateKey: wallet.privateKey }],
      selectedAddress: wallet.address,
      mnemonic: this.options?.mnemonicMode === "mnemonic-ephemeral" ? null : mnemonic,
      nextAccountIndex: 1
    };
    await this.saveStateEncrypted(password, state);
    return wallet.address;
  }

  async importMnemonic(password: string, mnemonic: string): Promise<string> {
    const phrase = mnemonic.trim();
    try {
      const wallet = HDNodeWallet.fromPhrase(phrase);
      const state: EmbeddedState = {
        accounts: [{ address: wallet.address, privateKey: wallet.privateKey }],
        selectedAddress: wallet.address,
        mnemonic: this.options?.mnemonicMode === "mnemonic-ephemeral" ? null : phrase,
        nextAccountIndex: 1
      };
      await this.saveStateEncrypted(password, state);
      return wallet.address;
    } catch (e) {
      throw mapWalletError(e, WalletErrorCodes.MNEMONIC_INVALID, "Invalid mnemonic phrase");
    }
  }

  async deriveNextAccount(password: string): Promise<string> {
    const state = await this.unlock(password);
    const phrase = this.getMnemonicForDerive(state);
    const accountIndex = Number(state.nextAccountIndex || 0);
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const wallet = HDNodeWallet.fromPhrase(phrase, undefined, path);
    const exists = state.accounts.some((a) => a.address.toLowerCase() === wallet.address.toLowerCase());
    const accounts = exists ? state.accounts : [...state.accounts, { address: wallet.address, privateKey: wallet.privateKey }];
    const nextState: EmbeddedState = {
      ...state,
      accounts,
      selectedAddress: wallet.address,
      nextAccountIndex: accountIndex + 1
    };
    await this.saveStateEncrypted(password, nextState);
    return wallet.address;
  }

  async listAccounts(password: string): Promise<string[]> {
    const state = await this.unlock(password);
    return state.accounts.map((a) => a.address);
  }

  async selectAccount(password: string, address: string): Promise<void> {
    const state = await this.unlock(password);
    const found = state.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
    if (!found) throw new WalletSdkError(WalletErrorCodes.WALLET_NOT_FOUND, "Account does not exist in keystore");
    const nextState: EmbeddedState = { ...state, selectedAddress: found.address };
    await this.saveStateEncrypted(password, nextState);
  }

  async unlock(password: string): Promise<EmbeddedState> {
    return this.loadStateDecrypted(password);
  }

  async signMessage(password: string, message: string): Promise<string> {
    const state = await this.unlock(password);
    const selected = this.getSelectedAccountOrThrow(state);
    const wallet = new Wallet(selected.privateKey);
    return wallet.signMessage(message);
  }

  async signTypedData(
    password: string,
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string> {
    const state = await this.unlock(password);
    const selected = this.getSelectedAccountOrThrow(state);
    const wallet = new Wallet(selected.privateKey);
    return wallet.signTypedData(
      domain as Parameters<typeof wallet.signTypedData>[0],
      types as Parameters<typeof wallet.signTypedData>[1],
      value as Parameters<typeof wallet.signTypedData>[2]
    );
  }

  async sendTransaction(password: string, rpcUrl: string, tx: TxRequestV1): Promise<string> {
    const state = await this.unlock(password);
    const selected = this.getSelectedAccountOrThrow(state);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(selected.privateKey, provider);
    try {
      const sent = await wallet.sendTransaction({
        to: tx.to,
        value: BigInt(tx.valueWei),
        data: tx.data,
        nonce: tx.nonce ? Number(tx.nonce) : undefined,
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
        chainId: tx.chainId ? Number(tx.chainId) : undefined
      });
      return sent.hash;
    } catch (e) {
      throw mapWalletError(e, WalletErrorCodes.TRANSACTION_FAILED, "Embedded transaction failed");
    }
  }
}
