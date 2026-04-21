'use client';

import Link from 'next/link';
import type { ChallengeRecord } from '@/lib/api';

export function ChallengeList(props: {
  challenges: ChallengeRecord[];
  loading: boolean;
  error: string | null;
}) {
  const { challenges, loading, error } = props;

  if (loading) return <p className="text-sm text-steel">加载挑战记录…</p>;
  if (error) return <p className="text-sm text-alert">{error}</p>;
  if (challenges.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100/60 bg-surface/50 p-6 text-center text-sm text-steel">
        暂无挑战记录。请在「挑战者首页」或下方表单发起挑战。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100/60">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface/80 text-xs uppercase text-steel">
          <tr>
            <th className="px-4 py-3">挑战 ID</th>
            <th className="px-4 py-3">提案</th>
            <th className="px-4 py-3">原因</th>
            <th className="px-4 py-3">质押</th>
            <th className="px-4 py-3">Tx</th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.challengeId} className="border-t border-gray-100/60">
              <td className="px-4 py-3 font-mono text-xs">{c.challengeId}</td>
              <td className="px-4 py-3">{c.proposalId}</td>
              <td className="px-4 py-3">{c.reasonCode}</td>
              <td className="px-4 py-3">{c.stakeAmount}</td>
              <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs" title={c.txHash}>
                {c.txHash.slice(0, 10)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-gray-100/60 px-4 py-3 text-xs text-steel">
        奖励与结算以链上 ChallengeManager 为准；此处为后端登记记录。详见{' '}
        <Link href="/challenger/rewards" className="text-primary underline">
          奖励查询
        </Link>
        。
      </p>
    </div>
  );
}
