import type { WalletEvent } from "../public/types";
import { InjectedProviderClient } from "../provider/injected";

type Handlers = {
  onAccountsChanged?: (accounts: string[]) => void;
  onChainChanged?: (chainIdHex: string) => void;
  onDisconnect?: (error?: unknown) => void;
  onEvent?: (event: WalletEvent) => void;
};

export function attachInjectedEvents(injected: InjectedProviderClient, handlers: Handlers): () => void {
  let lastChainId = "";
  let lastAccounts = "";

  const onAccountsChanged = (accounts: unknown) => {
    const normalized = ((accounts as string[]) || []).map((x) => String(x).toLowerCase());
    const key = normalized.join(",");
    if (key === lastAccounts) return;
    lastAccounts = key;
    handlers.onAccountsChanged?.(normalized);
    handlers.onEvent?.({ type: "accountChanged", accounts: normalized });
  };
  const onChainChanged = (chainIdHex: unknown) => {
    const normalized = String(chainIdHex || "");
    if (!normalized || normalized === lastChainId) return;
    lastChainId = normalized;
    handlers.onChainChanged?.(normalized);
    handlers.onEvent?.({ type: "chainChanged", chainIdHex: normalized });
  };
  const onDisconnect = (error: unknown) => {
    handlers.onDisconnect?.(error);
    handlers.onEvent?.({ type: "disconnected", error });
  };
  const onConnect = () => {
    handlers.onEvent?.({ type: "reconnected" });
  };

  injected.on("accountsChanged", onAccountsChanged);
  injected.on("chainChanged", onChainChanged);
  injected.on("disconnect", onDisconnect);
  injected.on("connect", onConnect);

  return () => {
    injected.off("accountsChanged", onAccountsChanged);
    injected.off("chainChanged", onChainChanged);
    injected.off("disconnect", onDisconnect);
    injected.off("connect", onConnect);
  };
}
