import type { EmbeddedKeystore } from "../keystore/keystore";
import { WalletErrorCodes, WalletSdkError } from "../errors";
import type { ChainConfig, TxRequestV1, TypedDataPayload, WalletClientOptions } from "../public/types";
import { normalizeTxRequest } from "./tx";

export function createEmbeddedService(
  embedded: EmbeddedKeystore,
  options: WalletClientOptions,
  runtime: "browser" | "node" = "browser"
) {
  return {
    async signMessage(message: string, opts?: { password?: string }) {
      if (!opts?.password) throw new WalletSdkError(WalletErrorCodes.INVALID_PASSWORD, "Embedded sign needs password");
      return embedded.signMessage(opts.password, message);
    },
    async signTypedData(typedData: TypedDataPayload, opts?: { password?: string }) {
      if (!opts?.password) throw new WalletSdkError(WalletErrorCodes.INVALID_PASSWORD, "Embedded signTypedData needs password");
      return embedded.signTypedData(opts.password, typedData.domain, typedData.types, typedData.message);
    },
    async sendTransaction(tx: TxRequestV1 | Record<string, unknown>, opts?: { password?: string; rpcUrl?: string }) {
      if (!opts?.password) throw new WalletSdkError(WalletErrorCodes.INVALID_PASSWORD, "Embedded sendTransaction needs password");
      const rpcUrl = opts.rpcUrl || options.rpcUrl;
      if (!rpcUrl) {
        throw new WalletSdkError(
          WalletErrorCodes.INVALID_PARAMS,
          runtime === "node" ? "Node sendTransaction needs rpcUrl" : "Embedded sendTransaction needs rpcUrl"
        );
      }
      const normalized = normalizeTxRequest(tx);
      return embedded.sendTransaction(opts.password, rpcUrl, normalized);
    },
    async switchChain() {
      throw new WalletSdkError(WalletErrorCodes.UNSUPPORTED_METHOD, "Embedded mode cannot switch chain");
    },
    async addChainThenSwitch(_chain: ChainConfig) {
      throw new WalletSdkError(WalletErrorCodes.UNSUPPORTED_METHOD, "Embedded mode cannot add/switch chain");
    }
  };
}
