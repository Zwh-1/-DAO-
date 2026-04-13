import { WalletErrorCodes, WalletSdkError } from "../errors";
import type { TxRequestV1 } from "../public/types";

export function normalizeTxRequest(input: TxRequestV1 | Record<string, unknown>): TxRequestV1 {
  const to = String((input as TxRequestV1).to || "");
  const valueWei = String((input as TxRequestV1).valueWei || "");
  if (!to || !valueWei) {
    throw new WalletSdkError(WalletErrorCodes.INVALID_PARAMS, "TxRequestV1 requires to/valueWei");
  }
  return {
    to,
    valueWei,
    gasLimit: (input as TxRequestV1).gasLimit ? String((input as TxRequestV1).gasLimit) : undefined,
    maxFeePerGas: (input as TxRequestV1).maxFeePerGas ? String((input as TxRequestV1).maxFeePerGas) : undefined,
    maxPriorityFeePerGas: (input as TxRequestV1).maxPriorityFeePerGas
      ? String((input as TxRequestV1).maxPriorityFeePerGas)
      : undefined,
    nonce: (input as TxRequestV1).nonce ? String((input as TxRequestV1).nonce) : undefined,
    chainId: (input as TxRequestV1).chainId ? String((input as TxRequestV1).chainId) : undefined,
    data: (input as TxRequestV1).data ? String((input as TxRequestV1).data) : undefined
  };
}
