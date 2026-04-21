"use client";

import { useCheckAuth } from "@/hooks/useCheckAuth";

/**
 * AuthBootstrap — 客户端启动组件
 *
 * 在应用挂载时静默恢复登录态（token 未过期则无需重新 SIWE）。
 * 挂载于 RootLayout，不渲染任何 UI。
 */
export function AuthBootstrap(): null {
  useCheckAuth();
  return null;
}
