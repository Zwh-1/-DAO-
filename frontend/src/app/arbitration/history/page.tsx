"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";
import { fetchMyArbTasks, type ArbTaskRow } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";

const VERDICT_LABEL: Record<string, string> = {
  approve: "批准", reject: "拒绝", abstain: "弃权", pending: "待裁决",
};
const VERDICT_COLOR: Record<string, string> = {
  approve: "text-success", reject: "text-alert", abstain: "text-steel", pending: "text-primary",
};

export default function ArbitrationHistoryPage() {
  const { address, isConnected } = useWallet();
  const [tasks, setTasks] = useState<ArbTaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) { setTasks([]); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyArbTasks(address);
      setTasks(r.tasks ?? []);
    } catch (e) {
      setTasks([]);
      setError(toUserErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const closedTasks = tasks.filter((t) => t.status && t.status !== "pending");

  return (
    <RoleGuard required="arbitrator">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/arbitration" className="text-steel hover:text-primary text-sm">← 仲裁工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">仲裁记录</h1>
            <p className="mt-1 section-desc">您已处理的历史仲裁案件及裁决结果。</p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">历史案件</h2>
              <button
                onClick={() => load()}
                disabled={!isConnected || loading}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              >
                刷新
              </button>
            </div>
            {!isConnected && <p className="text-sm text-steel">请先连接钱包。</p>}
            {isConnected && loading && (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
              </div>
            )}
            {isConnected && error && <p className="text-sm text-alert">{error}</p>}
            {isConnected && !loading && closedTasks.length === 0 && !error && (
              <p className="text-center py-10 text-steel text-sm">暂无历史仲裁记录</p>
            )}
            <div className="space-y-3">
              {closedTasks.map((t) => (
                <div key={t.taskId ?? t.proposalId} className="rounded-xl border border-gray-100/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-steel">案件 #{t.proposalId}</p>
                      <p className="text-sm font-semibold text-primary mt-0.5">提案 ID: {t.proposalId}</p>
                    </div>
                    <span className={`text-xs font-semibold ${VERDICT_COLOR[t.status ?? "pending"]}`}>
                      {VERDICT_LABEL[t.status ?? "pending"] ?? t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
