export type WalletMode = "auto" | "injected" | "embedded";
export type WalletRuntime = "injected" | "embedded";

export type Eip1193RequestArgs = {
  method: string;
  params?: unknown[];
};

export type Eip1193Provider = {
  request: (args: Eip1193RequestArgs) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
  providers?: Eip1193Provider[];
  isHealthWallet?: boolean;
};

export type KeystorePayload = {
  salt: number[];
  iv: number[];
  ciphertext: number[];
};

export type WalletRecord = {
  address: string;
  privateKey: string;
};

export type WalletClientOptions = {
  mode?: WalletMode;
  rpcUrl?: string;
  storageKey?: string;
  providerResolver?: () => Eip1193Provider | null;
  mnemonicMode?: "mnemonic-persisted" | "mnemonic-ephemeral";
};

export type TypedDataPayload = {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
};

export type TxRequestV1 = {
  to: string;
  valueWei: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
  chainId?: string;
  data?: string;
};

export type ChainConfig = {
  chainId: string;
  chainName?: string;
  rpcUrls?: string[];
  nativeCurrency?: { name: string; symbol: string; decimals: number };
};

export type WalletEvent =
  | { type: "accountChanged"; accounts: string[] }
  | { type: "chainChanged"; chainIdHex: string }
  | { type: "disconnected"; error?: unknown }
  | { type: "reconnected" };
