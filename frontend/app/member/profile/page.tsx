'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/features/wallet';
import { useAuthStore } from '@/store/authStore';
import { getMemberProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { RoleGuard } from '@/features/governance';
import { WalletAccountSection } from '@/features/wallet/WalletAccountSection';
import { getNetworkByChainId } from '@/lib/wallet/networks';
import { ProfileHero } from '@/features/member/ProfileSummaryRibbon';
import { formatJoinedAtDisplay } from '@/features/member/formatJoined';
import {
  ProfileQuickLinks,
  ProfilePrivacyFold,
  ProfileRoleHelp,
  ProfileActivityPlaceholder,
  ProfileReputationPlaceholder,
  ProfileExplorerLink,
} from '@/features/member/ProfilePageSections';

/* ── Inline icons for stat cards ─────────────────────────── */

function IconStar() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function IconShieldCheck() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.5 9-7 10-3.5-1-7-5-7-10V7l7-4z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

/* ── Stat Card ────────────────────────────────────────────── */

type StatCardProps = {
  label: string;
  value: string | null;
  loading?: boolean;
  icon: React.ReactNode;
  accent?: 'primary' | 'success';
  mono?: boolean;
};

function StatCard({ label, value, loading, icon, accent = 'primary', mono }: StatCardProps) {
  const color = accent === 'success' ? 'text-[#2D8A39]' : 'text-primary';
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(10,37,64,0.04)] transition-all duration-200 hover:shadow-md">
      <div className="mb-2 flex items-center gap-2">
        <span className={`${color} opacity-50`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-20 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className={`text-xl font-bold ${color} ${mono ? 'font-mono text-base' : ''}`}>
          {value ?? '—'}
        </p>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function MemberProfilePage() {
  const { address, isConnected, chainId } = useWallet();
  const walletRuntime = useAuthStore((s) => s.walletRuntime);
  const walletConnector = useAuthStore((s) => s.walletConnector);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const scrollToWallet = useCallback(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#wallet') return;
    requestAnimationFrame(() => {
      document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    scrollToWallet();
    window.addEventListener('hashchange', scrollToWallet);
    return () => window.removeEventListener('hashchange', scrollToWallet);
  }, [scrollToWallet]);

  const loadProfile = async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      const data = (await getMemberProfile(address)) as Record<string, unknown>;
      setProfile(data);
    } catch (err) {
      console.error('[MemberProfile] 加载失败:', err);
      setError('加载个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      void loadProfile();
    }
  }, [address, isConnected]);

  const maskAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const chainName = chainId != null ? getNetworkByChainId(chainId)?.name ?? '未知网络' : null;

  const rawLevel = profile?.level;
  const parsedLevel =
    typeof rawLevel === 'number' ? rawLevel : rawLevel != null ? Number(rawLevel) : NaN;
  const level =
    profile != null && !Number.isNaN(parsedLevel) ? parsedLevel : profile != null ? 1 : null;

  const rawCredit = profile?.creditScore;
  const parsedCredit =
    typeof rawCredit === 'number' ? rawCredit : rawCredit != null ? Number(rawCredit) : NaN;
  const creditScore =
    profile != null && !Number.isNaN(parsedCredit) ? parsedCredit : profile != null ? 0 : null;

  const memberTag =
    address && profile?.address
      ? String(profile.address).slice(0, 10) + '…'
      : address
        ? maskAddress(address)
        : null;

  const joinedAtDisplay = profile ? formatJoinedAtDisplay(profile.joinedAt) : undefined;

  return (
    <RoleGuard required="member">
      <div className="profile-page-shell">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:py-10">
          {/* ── Header ───────────────────────────────────── */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
              个人资料
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              管理身份信息、钱包会话与链上网络设置
            </p>
          </header>

          {/* ── Not-connected banner ─────────────────────── */}
          {!isConnected && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <svg className="h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>请先连接钱包以加载成员画像；也可在下方「钱包与网络」完成连接与签名（SIWE）。</span>
            </div>
          )}

          {/* ── Hero card (wallet identity) ──────────────── */}
          {isConnected && (
            <ProfileHero
              loading={loading}
              address={address}
              shortAddress={address ? maskAddress(address) : null}
              chainName={chainName}
              level={level != null && !Number.isNaN(level) ? level : null}
              creditScore={creditScore != null && !Number.isNaN(creditScore) ? creditScore : null}
              walletRuntime={walletRuntime}
              walletConnector={walletConnector}
              joinedAt={joinedAtDisplay}
              memberTag={memberTag}
            />
          )}

          {/* ── Quick links ──────────────────────────────── */}
          {isConnected && (
            <div className="mt-5">
              <ProfileQuickLinks />
            </div>
          )}

          {/* ── Main two-column grid ─────────────────────── */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Left: Wallet controls */}
            <div className="lg:col-span-2">
              <section className="profile-soft-card scroll-mt-24" id="wallet">
                <WalletAccountSection embedded />
              </section>
            </div>

            {/* Right: Profile data & credentials */}
            {isConnected && (
              <div className="space-y-6 lg:col-span-3">
                {/* Stat cards grid */}
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="成员等级"
                    value={loading ? null : `LV.${level ?? 1}`}
                    loading={loading}
                    icon={<IconStar />}
                    accent="primary"
                  />
                  <StatCard
                    label="声誉分数"
                    value={loading ? null : String(creditScore ?? 0)}
                    loading={loading}
                    icon={<IconShieldCheck />}
                    accent="success"
                  />
                  <StatCard
                    label="加入时间"
                    value={loading ? null : (joinedAtDisplay ?? '—')}
                    loading={loading}
                    icon={<IconCalendar />}
                    accent="primary"
                  />
                  <StatCard
                    label="成员标识"
                    value={loading ? null : (memberTag ?? '—')}
                    loading={loading}
                    icon={<IconTag />}
                    accent="primary"
                    mono
                  />
                </div>

                {/* Error state */}
                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm text-[#D93025]">
                    {error}
                    <Button onClick={loadProfile} variant="primary" size="sm" className="ml-3">
                      重试
                    </Button>
                  </div>
                )}

                {/* Empty profile state */}
                {!loading && !error && !profile && (
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-10 text-center">
                    <p className="text-sm text-slate-500">暂无个人资料数据</p>
                    <Button onClick={loadProfile} variant="primary" className="mt-4">
                      刷新
                    </Button>
                  </div>
                )}

                {/* Credentials & Activity */}
                <section className="profile-soft-card">
                  <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-primary">
                    <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    凭证与活动
                  </h2>

                  <div className="space-y-6">
                    {/* SBT */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-primary">SBT 代币</h3>
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8">
                        <div className="text-center">
                          <svg className="mx-auto mb-2 h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <p className="text-sm text-slate-400">暂无 SBT 代币</p>
                        </div>
                      </div>
                    </div>

                    {/* Auth status */}
                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="mb-3 text-sm font-semibold text-primary">身份认证</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 px-4 py-3">
                          <span className="text-sm text-slate-800">基础身份认证</span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2D8A39]">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            已认证
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-800">高级身份认证</span>
                          <span className="text-xs font-medium text-slate-400">未认证</span>
                        </div>
                      </div>
                    </div>

                    <ProfileActivityPlaceholder />
                    <ProfileReputationPlaceholder />
                    <ProfileExplorerLink address={address} chainId={chainId ?? undefined} />
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* ── Bottom full-width sections ────────────────── */}
          {isConnected && (
            <div className="mt-8 space-y-6">
              <ProfileRoleHelp />
              <ProfilePrivacyFold />
            </div>
          )}

          <footer className="mt-8 pb-4 text-center text-xs text-slate-400">
            如需帮助，请通过侧栏进入各工作台或查阅文档。AI 助手不会索要私钥或助记词。
          </footer>
        </div>
      </div>
    </RoleGuard>
  );
}
