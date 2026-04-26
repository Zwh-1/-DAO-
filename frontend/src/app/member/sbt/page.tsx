'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { identityApi, type SBTInfo } from '@/lib/api/identity';
import { RoleGuard } from '@/components/auth';
import { formatAddress } from '@/lib/utils/format';


function CreditBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 1000) * 100));
  const color =
    pct >= 80 ? '#2D8A39' : pct >= 50 ? '#D97706' : '#D93025';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>信用分（满分 1000）</span>
        <span className="font-semibold" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function SBTCard({ sbt }: { sbt: SBTInfo }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 via-white to-primary/[0.03] p-6 shadow-sm">
      {/* 背景装饰 */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.06]"
        style={{ backgroundColor: '#0A2540' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full opacity-[0.04]"
        style={{ backgroundColor: '#0A2540' }}
        aria-hidden
      />

      {/* 头部：图标 + 状态标签 */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-primary"
              aria-hidden
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-steel/50">
              Soulbound Token
            </p>
            <p className="font-mono text-sm font-bold text-primary">
              #{sbt.tokenId}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            已绑定
          </span>
          {sbt.isClaimEligible !== undefined && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                sbt.isClaimEligible
                  ? 'bg-success/10 text-success'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {sbt.isClaimEligible ? '可发起理赔' : '暂不满足理赔资格'}
            </span>
          )}
        </div>
      </div>

      {/* 信用分条 */}
      {sbt.creditScore !== undefined && (
        <div className="mb-5">
          <CreditBar score={sbt.creditScore} />
        </div>
      )}

      {/* 详情网格 */}
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-white/70 px-4 py-3 shadow-[0_0_0_1px_rgba(10,37,64,0.06)]">
          <dt className="mb-0.5 text-xs text-slate-400">持有者地址</dt>
          <dd className="font-mono font-medium text-primary">
            {formatAddress(sbt.address)}
          </dd>
        </div>
        <div className="rounded-xl bg-white/70 px-4 py-3 shadow-[0_0_0_1px_rgba(10,37,64,0.06)]">
          <dt className="mb-0.5 text-xs text-slate-400">身份等级</dt>
          <dd className="font-medium text-slate-700">
            Lv.{sbt.level ?? '—'}
          </dd>
        </div>
      </dl>

      {/* 来源标识 + 不可转让提示 */}
      <div className="mt-4 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 flex-shrink-0"
            aria-hidden
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          灵魂绑定代币 · 不可转让
        </p>
        {sbt.source && (
          <span className="text-xs text-slate-300">
            {sbt.source === 'onchain' ? '链上' : '本地'}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptySBT() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-8 py-16 text-center">
      <svg
        className="mb-4 h-12 w-12 text-slate-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
      <h3 className="mb-1 text-base font-semibold text-slate-600">
        尚未获得灵魂代币
      </h3>
      <p className="max-w-xs text-sm text-slate-400">
        完成身份注册并通过 Oracle 验证后，系统将自动为您铸造 SBT
      </p>
    </div>
  );
}

export default function MemberSBTPage() {
  const address = useAuthStore((s) => s.address);

  const { data, isLoading, isError } = useQuery<SBTInfo>({
    queryKey: ['sbt', address],
    queryFn: () => identityApi.getSBTInfo(address!),
    enabled: !!address,
    retry: 1,
  });

  const hasSBT = data?.sbtExists === true;

  return (
    <RoleGuard required="member">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* 页头 */}
        <section className="card">
          <h1 className="mb-1 text-2xl font-bold text-primary">灵魂代币</h1>
          <p className="text-sm text-slate-500">
            SBT（Soulbound Token）是绑定至您钱包地址的链上身份凭证，用于在 TrustAid 系统内锚定唯一身份。
          </p>
        </section>

        {/* SBT 内容 */}
        <section className="card">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : isError ? (
            <div className="py-10 text-center text-sm text-alert">查询失败，请稍后重试</div>
          ) : hasSBT ? (
            <SBTCard sbt={data} />
          ) : (
            <EmptySBT />
          )}
        </section>

        {/* 说明卡片 */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-primary">什么是灵魂代币？</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-success">✓</span>
              <span>与您的钱包地址永久绑定，不可转让或出售</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-success">✓</span>
              <span>通过零知识证明保护您的真实身份隐私</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-success">✓</span>
              <span>信用分反映您在系统中的参与记录与可信度</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-success">✓</span>
              <span>可用于理赔资格验证、仲裁资格及 DAO 治理投票</span>
            </li>
          </ul>
        </section>
      </div>
    </RoleGuard>
  );
}
