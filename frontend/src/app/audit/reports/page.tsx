"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";

interface Report {
  id: string;
  title: string;
  period: string;
  author: string;
  cid: string;
  publishedAt: string;
  summary: string;
}

const MOCK_REPORTS: Report[] = [
  {
    id: "R2026Q1",
    title: "2026 年 Q1 季度审计报告",
    period: "2026-01-01 ~ 2026-03-31",
    author: "0xGuardian…",
    cid: "Qm1234567890abcdef",
    publishedAt: "2026-04-05",
    summary: "Q1 共处理理赔 28 笔，赔付率 93.8%，检测到 2 起欺诈尝试已拦截，资金池健康状况良好。",
  },
  {
    id: "R2025Q4",
    title: "2025 年 Q4 季度审计报告",
    period: "2025-10-01 ~ 2025-12-31",
    author: "0xGuardian…",
    cid: "Qmabcdef1234567890",
    publishedAt: "2026-01-10",
    summary: "Q4 资金池增长 22%，仲裁案件 15 件，挑战成功率 40%，系统无重大安全事件。",
  },
];

export default function AuditReportsPage() {
  return (
    <RoleGuard required={["guardian", "dao"]} mode="any">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <div className="flex items-center justify-between">
              <div>
                <Link href="/audit" className="text-steel hover:text-primary text-sm">← 审计仪表盘</Link>
                <h1 className="text-2xl font-bold text-primary mt-3">历史报告</h1>
                <p className="mt-1 section-desc">所有已发布的审计报告，内容上链存储以保障不可篡改。</p>
              </div>
              <Link
                href="/audit/publish"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                + 发布报告
              </Link>
            </div>
          </section>

          <section className="card space-y-4">
            {MOCK_REPORTS.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-100/60 p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-primary">{r.title}</h3>
                    <p className="text-xs text-steel mt-0.5">报告期：{r.period}</p>
                  </div>
                  <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success flex-shrink-0">
                    已发布
                  </span>
                </div>
                <p className="text-sm text-steel">{r.summary}</p>
                <div className="flex items-center justify-between text-xs text-steel">
                  <span>发布于 {r.publishedAt}</span>
                  <a
                    href={`https://ipfs.io/ipfs/${r.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    IPFS: {r.cid.slice(0, 12)}…
                  </a>
                </div>
              </div>
            ))}
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
