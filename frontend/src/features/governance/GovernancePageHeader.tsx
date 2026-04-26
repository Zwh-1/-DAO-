'use client';

import React from 'react';
import Link from 'next/link';

interface GovernancePageHeaderProps {
  stats: { total: number; active: number; passed: number };
}

/**
 * DAO 治理中心页面头部
 * 
 * 展示：
 * - 页面标题
 * - 提案统计徽章
 * - 快捷导航链接
 */
export default function GovernancePageHeader({ stats }: GovernancePageHeaderProps) {
  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">DAO 治理中心</h1>
        {stats.total > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              共 {stats.total} 项
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              投票中 {stats.active}
            </span>
            <span className="rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
              已通过 {stats.passed}
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 section-desc">
        链下提案：<code className="text-xs bg-surface px-1 rounded">/v1/governance/*</code>
        ；链上队列/执行使用 <code className="text-xs bg-surface px-1 rounded">/v1/multisig/governance/*</code>。
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/governance/proposals" className="font-semibold text-primary underline">提案大厅</Link>
        <Link href="/governance/create" className="font-semibold text-primary underline">发起提案</Link>
        <Link href="/governance/vote" className="font-semibold text-primary underline">投票中心</Link>
        <Link href="/governance/delegate" className="font-semibold text-primary underline">委托投票</Link>
        <Link href="/governance/history" className="font-semibold text-primary underline">历史记录</Link>
        <Link href="/governance/treasury" className="font-semibold text-primary underline">金库</Link>
        <Link href="/governance/members" className="font-semibold text-primary underline">成员管理</Link>
      </div>
    </section>
  );
}
