"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";

/**
 * useCheckAuth — 页面挂载时静默恢复登录态
 *
 * 职责：
 * 1. 读取 Zustand persist 已恢复的 token + expiresAt
 * 2. 若 token 存在但已过期 → 清除 session（避免带失效 JWT 发请求）
 * 3. 若 token 有效 → 将 walletSessionState 恢复为 "unlocked"
 *
 * 调用位置：RootLayout 中的 AuthBootstrap 客户端组件（仅执行一次）。
 */
export function useCheckAuth(): void {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const { token, expiresAt, walletSessionState, setWalletSessionState, clearSession } =
      useAuthStore.getState();

    if (!token || !expiresAt) return;

    const isExpired = Date.now() >= expiresAt;

    if (isExpired) {
      clearSession();
      return;
    }

    if (walletSessionState !== "unlocked") {
      setWalletSessionState("unlocked");
    }
  }, []);
}
