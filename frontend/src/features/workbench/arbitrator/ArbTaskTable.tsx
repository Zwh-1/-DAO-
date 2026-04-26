'use client';

import Link from 'next/link';
import type { ArbTaskRow } from '@/lib/api';

export function ArbTaskTable(props: {
  tasks: ArbTaskRow[];
  loading: boolean;
  error: string | null;
  addressLabel?: string;
}) {
  const { tasks, loading, error, addressLabel } = props;

  if (loading) {
    return <p className="text-sm text-steel">加载仲裁任务…</p>;
  }
  if (error) {
    return <p className="text-sm text-alert">{error}</p>;
  }
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100/60 bg-surface/50 p-6 text-center text-sm text-steel">
        <p>暂无分配给您的仲裁任务。</p>
        {addressLabel && <p className="mt-2 font-mono text-xs text-primary">{addressLabel}</p>}
        <Link href="/arbitrator/vote" className="mt-4 inline-block text-sm font-semibold text-primary underline">
          前往投票表决（Commit / Reveal）
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100/60">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface/80 text-xs uppercase text-steel">
          <tr>
            <th className="px-4 py-3">任务 ID</th>
            <th className="px-4 py-3">提案 ID</th>
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.taskId} className="border-t border-gray-100/60">
              <td className="px-4 py-3 font-mono text-xs">{t.taskId}</td>
              <td className="px-4 py-3">{t.proposalId}</td>
              <td className="px-4 py-3">{t.status}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/arbitrator/vote?proposalId=${encodeURIComponent(t.proposalId)}`}
                  className="font-semibold text-primary underline"
                >
                  表决
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
