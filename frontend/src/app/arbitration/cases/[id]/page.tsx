"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";

const PHASES = ["待 Commit", "Commit 已提交", "等待 Reveal", "Reveal 完成", "已裁决"];

export default function ArbitrationCaseDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <RoleGuard required="arbitrator">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/arbitration/cases" className="text-steel hover:text-primary text-sm">← 案件列表</Link>
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-primary">案件详情</h1>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                投票中
              </span>
            </div>
            <p className="text-xs text-steel mt-1">提案 ID: {id}</p>
          </section>

          <section className="card space-y-4">
            <h2 className="section-title">裁决阶段</h2>
            <div className="flex gap-0 items-center">
              {PHASES.map((phase, i) => (
                <div key={phase} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex flex-col items-center gap-1 ${i === 0 ? "text-primary" : "text-steel"}`}>
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "border-primary text-primary" : "border-gray-200 text-steel"
                    }`}>
                      {i + 1}
                    </div>
                    <span className="text-xs whitespace-nowrap hidden sm:block">{phase}</span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 bg-gray-100" />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card space-y-3">
            <h2 className="section-title">案件信息</h2>
            {[
              ["提案 ID", id],
              ["申请人", "0x...（加密）"],
              ["申请金额", "— USDC"],
              ["Commit 截止", "—"],
              ["Reveal 截止", "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-100/60 last:border-0">
                <span className="text-sm text-steel">{label}</span>
                <span className="text-sm text-primary font-medium">{value}</span>
              </div>
            ))}
          </section>

          <section className="card">
            <h2 className="section-title mb-3">证据访问控制</h2>
            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-4 text-sm text-steel space-y-2">
              <p>• 证据经多签授权解密，限时访问，访问记录上链</p>
              <p>• 证据 IPFS CID 仅在 Reveal 阶段后可见</p>
              <p>• 所有访问均记入链上审计日志</p>
            </div>
            <button className="mt-3 w-full rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors opacity-50 cursor-not-allowed">
              申请证据访问（需多签授权）
            </button>
          </section>

          <div className="flex gap-3">
            <Link
              href={`/arbitration/vote?proposalId=${id}`}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              进入投票表决
            </Link>
            <Link
              href="/arbitration/cases"
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-steel hover:text-primary transition-colors"
            >
              返回列表
            </Link>
          </div>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
