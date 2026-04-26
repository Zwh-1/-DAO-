"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { GuardianBlacklistPanel } from "@/features/workbench/guardian";

export default function GuardianBlacklistPage() {
  return (
    <RoleGuard required="guardian">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">黑名单</h1>
          <p className="mt-2 section-desc">
            添加与列表查询均需 Guardian 鉴权；列表中的地址以脱敏形式展示。
          </p>
          <Link href="/guardian" className="mt-4 inline-block text-sm font-semibold text-primary underline">
            返回守护者工作台
          </Link>
        </section>

        <GuardianBlacklistPanel />
      </div>
    </RoleGuard>
  );
}
