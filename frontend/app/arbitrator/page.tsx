"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyArbTasks, type ArbTaskRow } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";
import { RoleGuard } from "@/features/governance";
import { useWallet } from "@/features/wallet";
import { PageTransition } from "@/components/ui/index";
import { ArbTaskTable, CommitRevealForms } from "@/features/workbench/arbitrator";

export default function ArbitratorPage() {
  const { address, isConnected } = useWallet();
  const [tasks, setTasks] = useState<ArbTaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!address) {
      setTasks([]);
      setError(null);
      return;
    }
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

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <RoleGuard required="arbitrator">
      <PageTransition>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">仲裁员工作台</h1>
          <p className="mt-2 section-desc">
            查阅分配任务并执行 Commit-Reveal；案件列表与表决也可在子页面集中使用。
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/arbitrator/cases" className="font-semibold text-primary underline">
              案件列表
            </Link>
            <Link href="/arbitrator/vote" className="font-semibold text-primary underline">
              投票表决
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">我的仲裁任务</h2>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              onClick={() => loadTasks()}
              disabled={!isConnected || !address}
            >
              刷新
            </button>
          </div>
          {!isConnected && <p className="text-sm text-steel">连接钱包后可加载与您地址关联的仲裁任务。</p>}
          {isConnected && address && (
            <ArbTaskTable tasks={tasks} loading={loading} error={error} addressLabel={address} />
          )}
        </section>

        <CommitRevealForms />
      </div>
      </PageTransition>
    </RoleGuard>
  );
}
