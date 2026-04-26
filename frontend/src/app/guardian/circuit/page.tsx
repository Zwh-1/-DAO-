'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/auth';
import { GuardianCircuitPanel } from '@/features/workbench/guardian';

export default function GuardianCircuitPage() {
  return (
    <RoleGuard required="guardian">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">熔断器</h1>
          <p className="mt-2 section-desc">
            紧急暂停与恢复需要 Guardian Token（本地存储 <code className="text-xs">guardianToken</code>
            ），并写入审计日志。
          </p>
          <Link href="/guardian" className="mt-4 inline-block text-sm font-semibold text-primary underline">
            返回守护者工作台
          </Link>
        </section>

        <GuardianCircuitPanel />
      </div>
    </RoleGuard>
  );
}
