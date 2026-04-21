'use client';

import Link from 'next/link';
import { RoleGuard } from '@/features/governance';
import { OracleReportsTable } from '@/features/workbench/oracle';

export default function OracleReportsPage() {
  return (
    <RoleGuard required="oracle">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">报告列表</h1>
          <p className="mt-2 section-desc">
            预言机报告摘要列表（需登录且具备预言机角色）。提交与签名请在预言机工作台完成。
          </p>
          <Link href="/oracle" className="mt-4 inline-block text-sm font-semibold text-primary underline">
            返回预言机工作台
          </Link>
        </section>

        <section className="card">
          <OracleReportsTable />
        </section>
      </div>
    </RoleGuard>
  );
}
