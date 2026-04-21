"use client";

import { useState, useCallback } from "react";
import { walletConnectorLabel } from "@/lib/wallet/walletLabels";
import type { WalletConnectorKind } from "@/store/authStore";

/* ── Types ───────────────────────────────────────────────── */

export type ProfileHeroProps = {
  loading?: boolean;
  address: string | null;
  shortAddress: string | null;
  chainName: string | null;
  level: number | null;
  creditScore: number | null;
  walletRuntime: "injected" | "embedded" | null;
  walletConnector: WalletConnectorKind | null;
  joinedAt?: string;
  memberTag?: string | null;
};

/* ── Avatar ──────────────────────────────────────────────── */

function AvatarFromAddress({ address }: { address: string | null }) {
  const hue = address ? parseInt(address.slice(2, 8), 16) % 360 : 200;
  const hue2 = (hue + 40) % 360;
  return (
    <div
      className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg ring-4 ring-white/20 sm:h-20 sm:w-20 sm:text-2xl"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 45%), hsl(${hue2}, 45%, 35%))`,
      }}
      aria-hidden
    >
      {address ? address.slice(2, 4).toUpperCase() : "??"}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────── */

function HeroSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#1A3A5A] p-6 shadow-xl md:p-8"
      aria-busy
      aria-label="加载摘要"
    >
      <div className="flex items-center gap-6">
        <div className="h-[4.5rem] w-[4.5rem] animate-pulse rounded-2xl bg-white/10 sm:h-20 sm:w-20" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-64 animate-pulse rounded bg-white/10" />
          <div className="flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────── */

/**
 * 个人资料英雄卡：深色主题展示钱包身份 + 等级/声誉/网络徽章
 */
export function ProfileHero({
  loading,
  address,
  shortAddress,
  chainName,
  level,
  creditScore,
  walletRuntime,
  walletConnector,
  joinedAt,
  memberTag,
}: ProfileHeroProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [address]);

  if (loading) return <HeroSkeleton />;

  const connector =
    walletRuntime && walletConnector
      ? walletConnectorLabel(walletConnector, walletRuntime)
      : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#1A3A5A] p-6 shadow-xl md:p-8">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/[0.03]" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/[0.02]" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <AvatarFromAddress address={address} />

        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Address line */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold text-white/90 sm:text-xl">
              {shortAddress ?? "未连接"}
            </span>
            {address && (
              <button
                type="button"
                onClick={copyAddress}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                {copied ? "已复制 ✓" : "复制"}
              </button>
            )}
          </div>

          {/* Full address */}
          {address && (
            <p className="truncate font-mono text-[11px] text-white/30">{address}</p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {level != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                LV.{level}
              </span>
            )}
            {creditScore != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                声誉 {creditScore}
              </span>
            )}
            {chainName && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                {chainName}
              </span>
            )}
            {connector && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                {connector}
              </span>
            )}
          </div>

          {/* Join date */}
          {joinedAt && joinedAt !== "—" && (
            <p className="text-xs text-white/40">加入于 {joinedAt}</p>
          )}
        </div>

        {/* Member tag (desktop only) */}
        {memberTag && (
          <div className="hidden text-right lg:block">
            <p className="text-[10px] uppercase tracking-wider text-white/40">成员标识</p>
            <p className="font-mono text-sm font-medium text-white/60">{memberTag}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** @deprecated 使用 ProfileHero 替代 */
export const ProfileSummaryRibbon = ProfileHero;
