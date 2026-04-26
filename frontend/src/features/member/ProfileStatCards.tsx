'use client';

import React from 'react';

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

interface ProfileStatCardsProps {
  loading: boolean;
  level: number | null;
  creditScore: number | null;
  joinedAtDisplay: string | undefined;
  memberTag: string | null;
}

/**
 * 个人资料统计卡片网格
 * 
 * 展示：
 * - 成员等级
 * - 声誉分数
 * - 加入时间
 * - 成员标识
 */
export default function ProfileStatCards({
  loading,
  level,
  creditScore,
  joinedAtDisplay,
  memberTag,
}: ProfileStatCardsProps) {
  return (
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
  );
}
