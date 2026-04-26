'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMyArbTasks, type ArbTaskRow } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';
import { RoleGuard } from '@/components/auth';
import { useWallet } from '@/features/wallet';
import { ArbTaskTable } from '@/features/workbench/arbitrator';

export default function ArbitrationCasesPage() {
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">待裁决案件</h1>
          <p className="mt-2 section-desc">
            以下数据来自后端为当前钱包地址分配的仲裁任务。从列表可跳转到投票页并预填提案 ID。
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/arbitration" className="font-semibold text-primary underline">
              返回仲裁工作台
            </Link>
            <Link href="/arbitration/vote" className="font-semibold text-primary underline">
              前往投票表决
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">分配任务</h2>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              onClick={() => loadTasks()}
              disabled={!isConnected || !address}
            >
              刷新
            </button>
          </div>
          {!isConnected && <p className="text-sm text-steel">请先连接钱包。</p>}
          {isConnected && address && (
            <ArbTaskTable tasks={tasks} loading={loading} error={error} addressLabel={address} />
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
