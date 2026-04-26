'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/features/wallet';
import { useAuthStore } from '@/store/authStore';
import { getMemberProfile } from '@/lib/api';
import { RoleGuard } from '@/components/auth';
import { WalletAccountSection } from '@/features/wallet/WalletAccountSection';
import { getNetworkByChainId } from '@/lib/wallet/networks';
import { ProfileHero } from '@/features/member/ProfileSummaryRibbon';
import { formatJoinedAtDisplay } from '@/features/member/formatJoined';
import MemberSBTPage from './sbt/page';
import {
  ProfileQuickLinks,
  ProfilePrivacyFold,
  ProfileRoleHelp,
  ProfileActivityPlaceholder,
  ProfileReputationPlaceholder,
  ProfileExplorerLink,
} from '@/features/member/ProfilePageSections';
import ProfileStatCards from '@/features/member/ProfileStatCards';
import ProfileAuthStatus from '@/features/member/ProfileAuthStatus';
import ProfilePageHeader from '@/features/member/ProfilePageHeader';

/**
 * 个人资料页面
 * 
 * 功能：
 * - 钱包身份展示
 * - 成员等级与声誉分数
 * - 身份认证状态
 * - SBT 代币管理
 */
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
  const sbtCount = typeof profile?.sbtCount === 'number' ? profile.sbtCount : 0;

  return (
    <RoleGuard required="member">
      <div className="profile-page-shell">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:py-10">
          {/* 页面头部 */}
          <ProfilePageHeader isConnected={isConnected} />

          {/* 钱包身份卡片 */}
          {isConnected && (
            <>
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

              {/* 快捷入口 */}
              <div className="mt-5">
                <ProfileQuickLinks />
              </div>
            </>
          )}

          {/* 主内容区：双栏布局 */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* 左侧：钱包控制 */}
            <div className="lg:col-span-2">
              <section className="profile-soft-card scroll-mt-24" id="wallet">
                <WalletAccountSection embedded />
              </section>
            </div>

            {/* 右侧：资料数据与凭证 */}
            {isConnected && (
              <div className="space-y-6 lg:col-span-3">
                {/* 统计卡片 */}
                <ProfileStatCards
                  loading={loading}
                  level={level}
                  creditScore={creditScore}
                  joinedAtDisplay={joinedAtDisplay}
                  memberTag={memberTag}
                />

                {/* 认证状态与凭证 */}
                <ProfileAuthStatus
                  error={error}
                  onRetry={loadProfile}
                  isLoading={loading}
                  hasProfile={!!profile}
                  sbtCount={sbtCount}
                />

                {/* 活动与声誉 */}
                <div className="space-y-6">
                  <ProfileActivityPlaceholder />
                  <ProfileReputationPlaceholder />
                  <ProfileExplorerLink address={address} chainId={chainId ?? undefined} />
                </div>
              </div>
            )}
          </div>

          {/* 底部全宽区域 */}
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
