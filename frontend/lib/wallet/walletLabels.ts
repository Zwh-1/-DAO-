import type { WalletConnectorKind } from "@/store/authStore";

/** 顶栏 / 导航等与 authStore.walletConnector 一致的短标签；connector 缺失时回退 runtime */
export function walletConnectorLabel(
  connector: WalletConnectorKind | null | undefined,
  runtime?: "injected" | "embedded" | null
): string {
  if (connector === "embedded") return "内置";
  if (connector === "walletconnect") return "WalletConnect";
  if (connector === "injected") return "浏览器钱包";
  if (runtime === "embedded") return "内置";
  if (runtime === "injected") return "浏览器钱包";
  return "";
}

export function walletConnectorAriaLabel(
  connector: WalletConnectorKind | null | undefined,
  runtime?: "injected" | "embedded" | null
): string {
  return `钱包类型：${walletConnectorLabel(connector, runtime) || "未知"}`;
}
