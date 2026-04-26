'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RoleGuard } from '@/components/auth';
import { CommitRevealForms } from '@/features/workbench/arbitrator';

function VoteContent() {
  const search = useSearchParams();
  const proposalId = search.get('proposalId')?.trim() || undefined;

  return (
    <>
      <section className="card">
        <h1 className="text-2xl font-bold text-primary">投票表决（Commit / Reveal）</h1>
        <p className="mt-2 section-desc">
          使用下方表单提交 Commit 与 Reveal；若从案件列表进入，提案 ID 已根据查询参数预填。
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/arbitration/cases" className="font-semibold text-primary underline">
            返回案件列表
          </Link>
          <Link href="/arbitration" className="font-semibold text-primary underline">
            仲裁工作台首页
          </Link>
        </div>
      </section>
      <CommitRevealForms initialProposalId={proposalId} />
    </>
  );
}

export default function ArbitrationVotePage() {
  return (
    <RoleGuard required="arbitrator">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <Suspense
          fallback={
            <section className="card">
              <p className="text-sm text-steel">加载表决表单…</p>
            </section>
          }
        >
          <VoteContent />
        </Suspense>
      </div>
    </RoleGuard>
  );
}
