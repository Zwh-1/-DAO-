"use client";

import { useCallback, useState } from "react";
import { useAuthStore, ROLE_ORDER, type RoleId } from "../store/authStore";
import { pickDefaultActiveRole, sanitizeRoles } from "../lib/utils/roleUtils";
import { mapWalletError, requestPrimaryAccount, signSiweMessage, walletRuntime } from "../lib/wallet/wallet-adapter";
import { V1Routes } from "../lib/api/v1Routes";

const ZERO = "0x0000000000000000000000000000000000000000";

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
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [activeRoleBusy, setActiveRoleBusy] = useState(false);

  const signIn = useCallback(async () => {
    setBusy(true);
    setWalletSessionState("pendingApproval");
    try {
      const addr = await requestPrimaryAccount();

      const nonceRes = await fetch(V1Routes.auth.nonce);
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

      const verifyRes = await fetch(V1Routes.auth.verify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      let verifyJson: {
        token?: string;
        address?: string;
        expiresAt?: number;
        roles?: string[];
        activeRole?: string;
        error?: string;
      } = {};
      try {
        verifyJson = await verifyRes.json();
      } catch {
        throw new Error("后端服务离线，签名验证失败，请先启动后端");
      }
      if (!verifyRes.ok || !verifyJson.token) {
        throw new Error(verifyJson.error || "登录失败");
      }
      const nextAddr = String(verifyJson.address || addr).toLowerCase();
      if (nextAddr === ZERO) {
        throw new Error("登录失败：服务端返回零地址");
      }
      const roles = sanitizeRoles(verifyJson.roles ?? ["member"]);
      const ar =
        verifyJson.activeRole && roles.includes(verifyJson.activeRole as RoleId)
          ? (verifyJson.activeRole as RoleId)
          : pickDefaultActiveRole(roles, null);
      setRoles(roles);
      setSession(verifyJson.token, nextAddr, verifyJson.expiresAt || 0, ar);
      setActiveRole(ar);
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

  /**
   * 按后端 ROLES_SOURCE 重新拉取角色并更新 JWT（链上 grant/revoke 或切链后调用）
   */
  const refreshRoles = useCallback(async () => {
    const t = useAuthStore.getState().token;
    if (!t) {
      throw new Error("请先登录");
    }
    setRefreshBusy(true);
    try {
      const res = await fetch(V1Routes.auth.refreshRoles, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      let json: {
        token?: string;
        address?: string;
        expiresAt?: number;
        roles?: string[];
        activeRole?: string;
        error?: string;
        hint?: string;
      } = {};
      try {
        json = await res.json();
      } catch {
        throw new Error("刷新失败：无法解析响应");
      }
      if (!res.ok || !json.token) {
        throw new Error(json.hint || json.error || "刷新角色失败");
      }
      const nextAddr = String(json.address || "").toLowerCase();
      if (nextAddr === ZERO) {
        throw new Error("刷新失败：服务端返回零地址");
      }
      const nextRoles = sanitizeRoles(json.roles ?? ["member"]);
      setRoles(nextRoles);
      const ar =
        json.activeRole && nextRoles.includes(json.activeRole as RoleId)
          ? (json.activeRole as RoleId)
          : pickDefaultActiveRole(nextRoles, useAuthStore.getState().activeRole);
      setSession(json.token, nextAddr, json.expiresAt || 0, ar);
      setActiveRole(ar);
      return json;
    } finally {
      setRefreshBusy(false);
    }
  }, [setSession, setRoles, setActiveRole]);

  /**
   * 在 JWT roles 范围内切换当前身份，并由服务端重签 JWT
   */
  const switchActiveRole = useCallback(
    async (role: RoleId) => {
      const t = useAuthStore.getState().token;
      const currentRoles = useAuthStore.getState().roles;
      if (!t) throw new Error("请先登录");
      if (!currentRoles.includes(role)) {
        throw new Error("无权使用该身份");
      }
      setActiveRoleBusy(true);
      try {
        const res = await fetch(V1Routes.auth.activeRole, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ activeRole: role }),
        });
        let json: {
          token?: string;
          address?: string;
          expiresAt?: number;
          roles?: string[];
          activeRole?: string;
          error?: string;
        } = {};
        try {
          json = await res.json();
        } catch {
          throw new Error("切换身份失败：无法解析响应");
        }
        if (!res.ok || !json.token) {
          throw new Error(json.error || "切换身份失败");
        }
        const nextAddr = String(json.address || "").toLowerCase();
        if (nextAddr === ZERO) {
          throw new Error("切换失败：服务端返回零地址");
        }
        const nextRoles = sanitizeRoles(json.roles ?? ["member"]);
        const ar =
          json.activeRole && nextRoles.includes(json.activeRole as RoleId)
            ? (json.activeRole as RoleId)
            : role;
        setRoles(nextRoles);
        setSession(json.token, nextAddr, json.expiresAt || 0, ar);
        setActiveRole(ar);
      } finally {
        setActiveRoleBusy(false);
      }
    },
    [setSession, setRoles, setActiveRole]
  );

  return {
    signIn,
    signOut,
    busy,
    token,
    address,
    refreshRoles,
    refreshBusy,
    switchActiveRole,
    activeRoleBusy,
  };
}
