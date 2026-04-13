import type { WalletMode, WalletRuntime } from "../public/types";

export function resolveRuntime(mode: WalletMode, injectedAvailable: boolean): WalletRuntime {
  if (mode === "embedded") return "embedded";
  if (mode === "injected") return "injected";
  return injectedAvailable ? "injected" : "embedded";
}
