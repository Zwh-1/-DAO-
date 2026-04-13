import { WalletErrorCodes, WalletSdkError } from "../errors";
import type { ChainConfig, TxRequestV1, TypedDataPayload } from "../public/types";
import { InjectedProviderClient } from "../provider/injected";
import { normalizeTxRequest } from "./tx";
import { mapWalletError } from "./error-mapper";

export function createInjectedService(injected: InjectedProviderClient) {
  return {
    async requestAccounts() {
      return injected.requestAccounts();
    },
    async signMessage(message: string) {
      const accounts = await injected.requestAccounts();
      const account = accounts[0];
      if (!account) throw new WalletSdkError(WalletErrorCodes.WALLET_NOT_FOUND, "No account returned by provider");
      return injected.signMessage(account, message);
    },
    async signTypedData(typedData: TypedDataPayload) {
      const accounts = await injected.requestAccounts();
      const account = accounts[0];
      if (!account) throw new WalletSdkError(WalletErrorCodes.WALLET_NOT_FOUND, "No account returned by provider");
      return injected.signTypedDataV4(account, JSON.stringify(typedData));
    },
    async sendTransaction(tx: TxRequestV1 | Record<string, unknown>) {
      const normalized = normalizeTxRequest(tx);
      try {
        return await injected.sendTransaction(normalized as unknown as Record<string, unknown>);
      } catch (e) {
        throw mapWalletError(e, WalletErrorCodes.TRANSACTION_FAILED, "Injected sendTransaction failed");
      }
    },
    async switchChain(chainIdHex: string) {
      try {
        await injected.switchChain(chainIdHex);
      } catch (e) {
        const mapped = mapWalletError(e, WalletErrorCodes.CHAIN_SWITCH_REJECTED, "Switch chain failed");
        if (mapped.code === WalletErrorCodes.CHAIN_NOT_ADDED) throw mapped;
        if (mapped.code === WalletErrorCodes.USER_REJECTED) {
          throw new WalletSdkError(WalletErrorCodes.CHAIN_SWITCH_REJECTED, mapped.message);
        }
        throw mapped;
      }
    },
    async addChainThenSwitch(chain: ChainConfig) {
      try {
        await injected.switchChain(chain.chainId);
      } catch (e) {
        const mapped = mapWalletError(e, WalletErrorCodes.CHAIN_SWITCH_REJECTED, "Add/switch chain failed");
        if (mapped.code === WalletErrorCodes.CHAIN_NOT_ADDED) {
          await injected.addChain(chain as unknown as Record<string, unknown>);
          await injected.switchChain(chain.chainId);
          return;
        }
        throw mapped;
      }
    }
  };
}
