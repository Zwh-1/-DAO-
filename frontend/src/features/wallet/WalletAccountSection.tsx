"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuthStore, ROLE_LABEL, ROLE_ORDER, type RoleId } from "@/store/authStore";
import { useSIWE } from "@/hooks/useSIWE";
import { sanitizeRoles } from "@/lib/utils/roleUtils";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { NetworkSwitcher } from "@/features/wallet/NetworkSwitcher";
import { WalletErrorDisplay, type WalletErrorCode } from "@/features/wallet/WalletErrorDisplay";
import { walletConnectorAriaLabel, walletConnectorLabel } from "@/lib/wallet/walletLabels";

const ConnectWalletModal = dynamic(
  () => import("@/features/wallet/ConnectWalletModal").then((m) => m.ConnectWalletModal),
  { ssr: false },
);

const KNOWN_CODES: WalletErrorCode[] = [
  "WALLET_NOT_FOUND",
  "INVALID_PASSWORD",
  "UNSUPPORTED_METHOD",
  "USER_REJECTED",
  "CHAIN_NOT_ADDED",
  "CHAIN_SWITCH_REJECTED",
  "INVALID_PARAMS",
  "TX_FAILED",
  "NETWORK_ERROR",
  "TIMEOUT",
  "UNKNOWN",
];

function normalizeErrorCode(code: string | null | undefined): WalletErrorCode {
  if (!code) return "UNKNOWN";
  return KNOWN_CODES.includes(code as WalletErrorCode) ? (code as WalletErrorCode) : "UNKNOWN";
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7a2 2 0 012-2h11a3 3 0 013 3v10a2 2 0 01-2 2H7a3 3 0 01-3-3V7z"
      />
      <path strokeLinecap="round" d="M8 11h6" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l7 4v5c0 5-3.5 9-7 10-3.5-1-7-5-7-10V7l7-4z"
      />
    </svg>
  );
}

function IconChain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5L21 3M16 3h5v5M10.5 13.5L3 21M8 21H3v-5" />
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="16" cy="16" r="2.5" />
    </svg>
  );
}

export type WalletAccountSectionProps = {
  embedded?: boolean;
};

export function WalletAccountSection({ embedded = false }: WalletAccountSectionProps) {
  const { token, address, walletRuntime, walletConnector, error, errorCode, roles, activeRole, setActiveRole } =
    useAuthStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const clearWalletError = useAuthStore((s) => s.clearWalletError);
  const { signOut, busy, refreshRoles, refreshBusy, switchActiveRole, activeRoleBusy } = useSIWE();
  const { chainId } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [roleHint, setRoleHint] = useState<string | null>(null);
  const prevChainRef = useRef<number | null | undefined>(undefined);

  const shell = embedded ? "w-full space-y-6" : "mx-auto w-full max-w-2xl space-y-6";
  const titleClass = embedded ? "text-lg font-bold text-primary mb-2" : "text-xl font-bold text-primary mb-2";
  const subtitleClass = embedded ? "text-sm text-steel" : "text-sm leading-relaxed text-steel";
  const compactShell = embedded ? "w-full space-y-4" : "mx-auto w-full max-w-lg";

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [address]);

  const handleSyncChainRoles = useCallback(async () => {
    setSyncHint(null);
    try {
      await refreshRoles();
      setSyncHint("已与后端同步角色（含链上解析，取决于 ROLES_SOURCE）。");
    } catch (e) {
      setSyncHint(e instanceof Error ? e.message : "同步失败");
    }
  }, [refreshRoles]);

  useEffect(() => {
    if (!token || chainId == null) return;
    if (prevChainRef.current === undefined) {
      prevChainRef.current = chainId;
      return;
    }
    if (prevChainRef.current !== chainId) {
      prevChainRef.current = chainId;
      void refreshRoles().catch(() => {
        setSyncHint("切链后同步角色失败，可手动点击同步。");
      });
    }
  }, [chainId, token, refreshRoles]);

  useEffect(() => {
    if (!token || !address || !isAuthenticated) return;
    const valid = sanitizeRoles(roles);
    if (valid.length === 0) {
      if (activeRole !== null) setActiveRole(null);
      return;
    }
    if (activeRole && valid.includes(activeRole)) return;
    const next = ROLE_ORDER.find((r) => valid.includes(r)) ?? valid[0];
    setActiveRole(next);
  }, [token, address, isAuthenticated, roles, activeRole, setActiveRole]);

  if (!token || !address) {
    return (
      <div className={compactShell}>
        {embedded ? (
          <h2 className={titleClass}>钱包与网络</h2>
        ) : (
          <h1 className={titleClass}>钱包与网络</h1>
        )}
        <p className={`mb-5 ${subtitleClass}`}>
          连接钱包并完成签名验证（SIWE）后，可在此查看完整地址、切换身份与网络、退出会话。
        </p>
        <div className="rounded-xl border border-primary/30 bg-primary/[0.05] px-4 py-4">
          <Button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={busy}
            className="bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "连接中…" : "连接钱包 / Sign-In"}
          </Button>
        </div>
        <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={compactShell}>
        {embedded ? (
          <h2 className={titleClass}>钱包与网络</h2>
        ) : (
          <h1 className={titleClass}>钱包与网络</h1>
        )}
        <p className={`mb-5 ${subtitleClass}`}>
          当前登录会话已失效或已过期，请重新连接钱包并完成签名以继续使用身份与网络管理功能。
        </p>
        <div className="rounded-xl border border-alert/30 bg-alert/5 px-4 py-4">
          <p className="mb-3 text-sm text-slate-800">为保护账户安全，过期后需重新验证钱包控制权。</p>
          <Button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={busy}
            className="bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "连接中…" : "重新登录"}
          </Button>
        </div>
        <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  const safeRoles = sanitizeRoles(roles);
  const displayRoleLabel =
    activeRole && safeRoles.includes(activeRole)
      ? ROLE_LABEL[activeRole]
      : safeRoles[0]
        ? ROLE_LABEL[safeRoles[0]]
        : "—";

  const missingRoles = ROLE_ORDER.filter((r) => !safeRoles.includes(r));

  const identityBlock = (
    <>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        切换当前使用的平台身份（与侧栏一致）。仅可选择 JWT 中已拥有的角色；切换将请求服务端重签 Token。
      </p>
      <details className="mb-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
        <summary className="cursor-pointer select-none font-medium text-slate-600">敏感接口说明</summary>
        <p className="mt-2 leading-relaxed">
          敏感接口仍以服务端校验的「角色列表」为准，当前身份主要用于导航与工作台。
        </p>
      </details>
      <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-[11px] text-slate-500">当前身份</p>
        <p className="text-sm font-semibold text-primary">{displayRoleLabel}</p>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSyncChainRoles()}
          disabled={refreshBusy}
          className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
        >
          {refreshBusy ? "同步中…" : "同步链上角色"}
        </button>
        {syncHint && <p className="text-xs text-slate-500">{syncHint}</p>}
      </div>
      <p className="mb-2 text-[11px] text-slate-500">切换身份</p>
      {roleHint && <p className="mb-2 text-xs text-[#D93025]">{roleHint}</p>}
      <div className="flex flex-wrap gap-2">
        {safeRoles.map((r) => {
          const isActive = r === activeRole;
          return (
            <button
              key={r}
              type="button"
              disabled={activeRoleBusy}
              onClick={() => {
                setRoleHint(null);
                void switchActiveRole(r).catch((e) =>
                  setRoleHint(e instanceof Error ? e.message : "切换失败"),
                );
              }}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                isActive ? "bg-primary text-white" : "bg-slate-100 text-primary hover:bg-primary/10"
              } ${activeRoleBusy ? "opacity-70" : ""}`}
            >
              {ROLE_LABEL[r]}
            </button>
          );
        })}
      </div>
      {missingRoles.length > 0 && (
        <details className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">其他角色说明</summary>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            以下角色需在链上授权或治理分配后方可使用：
            {missingRoles.map((r) => ROLE_LABEL[r]).join("、")}
            。
          </p>
        </details>
      )}
    </>
  );

  const accountBlock = (
    <>
      <div className="break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">{address}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyAddress}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-slate-50"
        >
          {copied ? "已复制" : "复制地址"}
        </button>
        {walletRuntime && (
          <span
            className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-600"
            aria-label={walletConnectorAriaLabel(walletConnector, walletRuntime)}
          >
            {walletConnectorLabel(walletConnector, walletRuntime)}
          </span>
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="w-full space-y-0">
        <div className="border-b border-slate-100 pb-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">钱包与网络</h2>
              <p className="mt-1 text-sm text-slate-500">管理当前连接的账户、身份与网络</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="border-b border-slate-100 py-4">
            <WalletErrorDisplay
              errorCode={normalizeErrorCode(errorCode)}
              message={error}
              showSuggestion
              onClose={() => clearWalletError()}
              size="md"
            />
          </div>
        )}

        <div className="flex flex-col gap-8 pt-6 md:grid md:grid-cols-2 md:gap-8 md:pt-8">
          <section aria-labelledby="wallet-account-heading" className="md:col-start-1 md:row-start-1">
            <div className="mb-3 flex items-center gap-2">
              <IconWallet className="h-6 w-6 shrink-0 text-primary" />
              <h3 id="wallet-account-heading" className="text-base font-semibold text-primary">
                账户
              </h3>
            </div>
            {accountBlock}
          </section>

          <section
            aria-labelledby="wallet-identity-heading"
            className="border-t border-slate-100 pt-8 md:col-start-2 md:row-start-1 md:row-span-2 md:border-t-0 md:pt-0"
          >
            <div className="mb-3 flex items-center gap-2">
              <IconShield className="h-6 w-6 shrink-0 text-primary" />
              <h3 id="wallet-identity-heading" className="text-base font-semibold text-primary">
                身份
              </h3>
            </div>
            {identityBlock}
          </section>

          <section
            aria-labelledby="wallet-network-heading"
            className="border-t border-slate-100 pt-8 md:col-start-1 md:row-start-2 md:border-t-0 md:pt-0"
          >
            <div className="mb-3 flex items-center gap-2">
              <IconChain className="h-6 w-6 shrink-0 text-primary" />
              <h3 id="wallet-network-heading" className="text-base font-semibold text-primary">
                网络
              </h3>
            </div>
            <NetworkSwitcher size="md" />
          </section>
        </div>

        <div className="mt-8 flex justify-end border-t border-slate-100 pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            disabled={busy || signingOut}
            className="text-sm text-[#D93025] hover:bg-red-50 hover:text-[#D93025]"
          >
            {signingOut ? "退出中…" : "退出登录"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div>
        <h1 className="text-xl font-bold text-primary">钱包与网络</h1>
        <p className="mt-1 text-sm text-steel">管理当前连接的账户、身份与网络</p>
      </div>

      {error && (
        <WalletErrorDisplay
          errorCode={normalizeErrorCode(errorCode)}
          message={error}
          showSuggestion
          onClose={() => clearWalletError()}
          size="md"
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-primary">账户</h3>
        <div className="mb-3 break-all font-mono text-sm text-slate-800">{address}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyAddress}
            className="rounded-xl border border-slate-200 bg-surface px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-slate-100"
          >
            {copied ? "已复制" : "复制地址"}
          </button>
          {walletRuntime && (
            <span
              className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-steel"
              aria-label={walletConnectorAriaLabel(walletConnector, walletRuntime)}
            >
              {walletConnectorLabel(walletConnector, walletRuntime)}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-primary">身份</h3>
        <p className="mb-3 text-xs text-steel">
          切换当前使用的平台身份（与侧栏一致）。仅可选择 JWT 中已拥有的角色；切换将请求服务端重签 Token。
        </p>
        <p className="mb-3 text-[11px] text-steel">
          敏感接口仍以服务端校验的「角色列表」为准，当前身份主要用于导航与工作台。
        </p>
        <div className="mb-3 rounded-input bg-surface px-3 py-2">
          <p className="text-[11px] text-steel">当前身份</p>
          <p className="text-sm font-semibold text-primary">{displayRoleLabel}</p>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSyncChainRoles()}
            disabled={refreshBusy}
            className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
          >
            {refreshBusy ? "同步中…" : "同步链上角色"}
          </button>
          {syncHint && <p className="text-xs text-steel">{syncHint}</p>}
        </div>
        <p className="mb-2 text-[11px] text-steel">切换身份</p>
        {roleHint && <p className="mb-2 text-xs text-alert">{roleHint}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROLE_ORDER.map((r: RoleId) => {
            const hasRole = safeRoles.includes(r);
            const isActive = hasRole && r === activeRole;
            return (
              <button
                key={r}
                type="button"
                disabled={!hasRole || activeRoleBusy}
                onClick={() => {
                  if (!hasRole) return;
                  setRoleHint(null);
                  void switchActiveRole(r).catch((e) =>
                    setRoleHint(e instanceof Error ? e.message : "切换失败"),
                  );
                }}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  isActive ? "bg-primary text-white" : ""
                } ${hasRole && !isActive && !activeRoleBusy ? "cursor-pointer bg-surface text-primary hover:bg-primary/10" : ""} ${
                  !hasRole ? "cursor-not-allowed bg-slate-50 text-steel/40" : ""
                } ${activeRoleBusy && hasRole ? "opacity-70" : ""}`}
              >
                {!hasRole && (
                  <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  </svg>
                )}
                {ROLE_LABEL[r]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-primary">网络</h3>
        <NetworkSwitcher size="md" />
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSignOut}
          disabled={busy || signingOut}
          className="text-sm text-alert hover:bg-red-50 hover:text-alert"
        >
          {signingOut ? "退出中…" : "退出登录"}
        </Button>
      </div>
    </div>
  );
}

export function WalletAccountPage(props: WalletAccountSectionProps) {
  return <WalletAccountSection {...props} />;
}
