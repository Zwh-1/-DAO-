"use client";

import { useCallback, useState } from "react";
import { useAuthStore, type RoleId } from "../store/authStore";
import { mapWalletError, requestPrimaryAccount, signSiweMessage, walletRuntime } from "../lib/wallet-adapter";

const API_BASE = "/v1";

function buildSiweMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
}) {
  return `${params.domain} wants you to sign in with your Ethereum account:\n${params.address}\n\nSign in to TrustAid (SIWE)\n\nURI: https://${params.domain}\nVersion: 1\nChain ID: 1\nNonce: ${params.nonce}\nIssued At: ${params.issuedAt}`;
}

export function useSIWE() {
  const { setSession, clearSession, token, address, setWalletSessionState, setRoles, setActiveRole } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async () => {
    setBusy(true);
    setWalletSessionState("pendingApproval");
    try {
      const addr = await requestPrimaryAccount();

      const nonceRes = await fetch(`${API_BASE}/auth/nonce`);
      let nonceJson: { nonce?: string } = {};
      try {
        nonceJson = (await nonceRes.json()) as { nonce?: string };
      } catch {
        throw new Error("后端服务离线，请先运行 `npm run dev` 启动后端（端口 3010）再登录");
      }
      if (!nonceRes.ok || !nonceJson.nonce) throw new Error("获取 nonce 失败");

      const issuedAt = new Date().toISOString();
      const domain = window.location.host || "localhost";
      const message = buildSiweMessage({ domain, address: addr, nonce: nonceJson.nonce, issuedAt });

      const signature = await signSiweMessage(message);

      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature })
      });
      let verifyJson: { token?: string; address?: string; expiresAt?: number; roles?: string[]; error?: string } = {};
      try {
        verifyJson = await verifyRes.json();
      } catch {
        throw new Error("后端服务离线，签名验证失败，请先启动后端");
      }
      if (!verifyRes.ok || !verifyJson.token) {
        throw new Error(verifyJson.error || "登录失败");
      }
      setSession(verifyJson.token, verifyJson.address || addr.toLowerCase(), verifyJson.expiresAt || 0);
      const roles = (verifyJson.roles ?? ["member"]) as RoleId[];
      setRoles(roles);
      setActiveRole(roles[0] ?? "member");
      setWalletSessionState("unlocked");
      return { ...verifyJson, runtime: walletRuntime() };
    } catch (e) {
      setWalletSessionState("failed");
      throw mapWalletError(e);
    } finally {
      setBusy(false);
    }
  }, [setSession, setWalletSessionState, setRoles, setActiveRole]);

  const signOut = useCallback(() => clearSession(), [clearSession]);

  return { signIn, signOut, busy, token, address };
}
