"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useGovernanceProposals } from "@/hooks/useQueries";
import { toUserErrorMessage } from "@/lib/error-map";

const STATE_LABEL: Record<string, string> = {
  "0": "待定", "1": "投票中", "2": "通过", "3": "否决",
  "4": "排队中", "5": "已执行", "6": "已取消",
};
const STATE_COLOR: Record<string, string> = {
  "0": "text-steel", "1": "text-primary font-semibold",
  "2": "text-success font-semibold", "3": "text-alert font-semibold",
  "4": "text-primary", "5": "text-success", "6": "text-steel line-through",
};

export default function GovernanceHistoryPage() {
  const { proposals, isLoading, error, refetch, isRefetching } = useGovernanceProposals({
    autoRefresh: false,
  });

  const closedProposals = proposals.filter(
    (p: { state: string }) => ["2", "3", "5", "6"].includes(p.state)
  );

  return (
    <RoleGuard required="dao">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/governance" className="text-steel hover:text-primary text-sm">← 治理中心</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">历史记录</h1>
            <p className="mt-1 section-desc">已结束的提案（通过、否决、已执行、已取消）。</p>
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">历史提案</h2>
              <button
                onClick={() => refetch()}
                className="text-sm text-primary underline hover:opacity-80"
                disabled={isRefetching}
              >
                {isRefetching ? "刷新中…" : "刷新"}
              </button>
            </div>
            {isLoading && <p className="text-sm text-steel">加载中...</p>}
            {error && <p className="text-sm text-alert">{toUserErrorMessage(error)}</p>}
            {!isLoading && closedProposals.length === 0 && !error && (
              <div className="text-center py-12 text-steel text-sm">
                暂无已结束的提案
              </div>
            )}
            <div className="space-y-3">
              {closedProposals.map((p: { id: number; description: string; state: string; forVotes: string; againstVotes: string; abstainVotes: string }) => (
                <Link
                  key={p.id}
                  href={`/governance/proposals/${p.id}`}
                  className="block card-compact hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs text-steel mr-2">#{p.id}</span>
                      <span className="text-sm font-semibold text-primary">{p.description}</span>
                    </div>
                    <span className={`text-xs whitespace-nowrap ml-2 ${STATE_COLOR[p.state] ?? "text-steel"}`}>
                      {STATE_LABEL[p.state] ?? p.state}
                    </span>
                  </div>
                  <div className="flex gap-6 text-xs text-steel">
                    <span className="text-success">赞成 {p.forVotes}</span>
                    <span className="text-alert">反对 {p.againstVotes}</span>
                    <span>弃权 {p.abstainVotes}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
