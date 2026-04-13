import type { Eip1193Provider } from "../public/types";

type BrowserWindow = Window & {
  ethereum?: Eip1193Provider;
  healthWallet?: Eip1193Provider;
};

export function resolveInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as BrowserWindow;
  const eth = w.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers.find((p) => p.isHealthWallet) || eth.providers[0] || null;
  }
  return w.healthWallet || eth;
}
