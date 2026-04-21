'use client';

import Link from 'next/link';
import { RoleGuard } from '@/features/governance';
import { ChannelsTable } from '@/features/workbench/oracle';

export default function OracleChannelsPage() {
  return (
    <RoleGuard required="oracle">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">支付通道</h1>
          <p className="mt-2 section-desc">
            调试级通道列表需要有效 JWT。若返回 403，请确认已使用 SIWE 登录且后端允许当前角色访问。
          </p>
          <Link href="/oracle" className="mt-4 inline-block text-sm font-semibold text-primary underline">
            返回预言机工作台
          </Link>
        </section>

        <section className="card">
          <ChannelsTable />
        </section>
      </div>
    </RoleGuard>
  );
}
