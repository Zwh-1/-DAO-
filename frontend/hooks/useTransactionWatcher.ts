"use client";

import { useCallback, useState } from "react";
import { getWalletTxHistory, waitForTxReceipt } from "../lib/wallet-adapter";

type TxUiState = { status: "idle" | "submitted" | "confirmed" | "failed"; detail?: string };
export function useTransactionWatcher() {
  const [state, setState] = useState<TxUiState>({ status: "idle" });
  const [history, setHistory] = useState(getWalletTxHistory());

  const watchTxHash = useCallback(async (txHash: string, opts?: { rpcUrl?: string }) => {
    setState({ status: "submitted", detail: `Tx: ${txHash.slice(0, 10)}…` });
    try {
      const receipt = await waitForTxReceipt(txHash, opts);
      if (receipt && typeof receipt === 'object' && 'blockNumber' in receipt) {
        const blockNum = (receipt as any).blockNumber;
        setState({ status: "confirmed", detail: `已确认：block ${blockNum}` });
      } else {
        setState({ status: "failed", detail: "交易未确认" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: "failed", detail: msg });
    } finally {
      setHistory(getWalletTxHistory());
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
    setHistory(getWalletTxHistory());
  }, []);

  return { state, watchTxHash, reset, history };
}
