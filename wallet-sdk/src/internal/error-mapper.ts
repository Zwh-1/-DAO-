import { WalletErrorCodes, WalletSdkError } from "../errors";

export function mapWalletError(input: unknown, fallbackCode: string, fallbackMessage: string): WalletSdkError {
  if (input instanceof WalletSdkError) return input;
  const err = input as { code?: string | number; message?: string };
  const code = err?.code;
  const msg = String(err?.message || fallbackMessage);

  if (code === 4001) return new WalletSdkError(WalletErrorCodes.USER_REJECTED, msg);
  if (code === 4902) return new WalletSdkError(WalletErrorCodes.CHAIN_NOT_ADDED, msg);
  if (code === -32602) return new WalletSdkError(WalletErrorCodes.INVALID_PARAMS, msg);
  if (/insufficient funds/i.test(msg)) return new WalletSdkError(WalletErrorCodes.INSUFFICIENT_FUNDS, msg);
  if (/nonce/i.test(msg)) return new WalletSdkError(WalletErrorCodes.NONCE_CONFLICT, msg);
  if (/network|rpc|connect|timeout|econnrefused/i.test(msg)) return new WalletSdkError(WalletErrorCodes.RPC_UNAVAILABLE, msg);
  if (/mnemonic|invalid phrase/i.test(msg)) return new WalletSdkError(WalletErrorCodes.MNEMONIC_INVALID, msg);
  if (/corrupt|unexpected token|json/i.test(msg) && fallbackCode === WalletErrorCodes.STORAGE_CORRUPTED) {
    return new WalletSdkError(WalletErrorCodes.STORAGE_CORRUPTED, msg);
  }
  return new WalletSdkError(fallbackCode, msg || fallbackMessage);
}
