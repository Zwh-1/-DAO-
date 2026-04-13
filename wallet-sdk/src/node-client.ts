import { EmbeddedKeystore } from "./keystore/keystore";
import { WalletSdkError, WalletErrorCodes } from "./errors";
import type { TxRequestV1, TypedDataPayload } from "./public/types";
import { createEmbeddedService } from "./internal/embedded-service";
import { mapWalletError } from "./internal/error-mapper";

type NodeStorage = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
};

class Mutex {
  private queue = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

function createNodeFileStorage(filePath: string): NodeStorage {
  const writeLock = new Mutex();
  return {
    async read() {
      try {
        const fs = await import("node:fs/promises");
        return await fs.readFile(filePath, "utf8");
      } catch (e) {
        const err = e as { code?: string };
        if (err?.code === "ENOENT") return null;
        throw mapWalletError(e, WalletErrorCodes.STORAGE_CORRUPTED, "Failed to read keystore file");
      }
    },
    async write(_, value: string) {
      await writeLock.run(async () => {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const handle = await fs.open(tmpPath, "w");
        try {
          await handle.writeFile(value, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        try {
          await fs.rename(tmpPath, filePath);
        } catch (e) {
          await fs.unlink(tmpPath).catch(() => undefined);
          throw mapWalletError(e, WalletErrorCodes.STORAGE_CORRUPTED, "Atomic keystore write failed");
        }
      });
    }
  };
}

export function createNodeWalletClient(options?: {
  filePath?: string;
  storageKey?: string;
  mnemonicMode?: "mnemonic-persisted" | "mnemonic-ephemeral";
}) {
  const filePath = options?.filePath || `${process.cwd()}/.wallet-sdk.keystore.json`;
  const storageKey = options?.storageKey || "trustaid_wallet_sdk_keystore";
  const ks = new EmbeddedKeystore(createNodeFileStorage(filePath), storageKey, {
    mnemonicMode: options?.mnemonicMode || "mnemonic-persisted"
  });
  const embeddedSvc = createEmbeddedService(ks, { rpcUrl: undefined, mnemonicMode: options?.mnemonicMode }, "node");

  return {
    getRuntimeInfo() {
      return { runtime: "embedded" as const };
    },
    async createEmbeddedWallet(password: string) {
      return ks.create(password);
    },
    async importEmbeddedMnemonic(password: string, mnemonic: string) {
      return ks.importMnemonic(password, mnemonic);
    },
    async deriveNextEmbeddedAccount(password: string) {
      return ks.deriveNextAccount(password);
    },
    async listEmbeddedAccounts(password: string) {
      return ks.listAccounts(password);
    },
    async selectEmbeddedAccount(password: string, address: string) {
      return ks.selectAccount(password, address);
    },
    async signMessage(message: string, opts?: { password?: string }) {
      return embeddedSvc.signMessage(message, opts);
    },
    async signTypedData(typedData: TypedDataPayload, opts?: { password?: string }) {
      return embeddedSvc.signTypedData(typedData, opts);
    },
    async sendTransaction(tx: TxRequestV1 | Record<string, unknown>, opts?: { password?: string; rpcUrl?: string }) {
      return embeddedSvc.sendTransaction(tx, opts);
    },
    async switchChain() {
      throw new WalletSdkError(WalletErrorCodes.UNSUPPORTED_METHOD, "switchChain is injected-only in Node client");
    },
    subscribe() {
      return () => {};
    }
  };
}
