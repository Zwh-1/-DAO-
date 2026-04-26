'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listMyChallenges, type ChallengeRecord } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';
import { RoleGuard } from '@/components/auth';
import { useWallet } from '@/features/wallet';
import { ChallengeList } from '@/features/workbench/challenger';

export default function ChallengeListPage() {
  const { address, isConnected } = useWallet();
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setChallenges([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await listMyChallenges(address);
      setChallenges(r.challenges ?? []);
    } catch (e) {
      setChallenges([]);
      setError(toUserErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <RoleGuard required="challenger">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">我的挑战</h1>
          <p className="mt-2 section-desc">
            列出后端登记的挑战记录（需登录 JWT 且地址与代币挑战者一致）。
          </p>
          <Link
            href="/challenge"
            className="mt-4 inline-block text-sm font-semibold text-primary underline"
          >
            返回挑战者工作台发起新挑战
          </Link>
        </section>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">挑战记录</h2>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              onClick={() => refresh()}
              disabled={!isConnected || !address}
            >
              刷新
            </button>
          </div>
          {!isConnected && <p className="text-sm text-steel">请先连接钱包。</p>}
          {isConnected && address && (
            <ChallengeList challenges={challenges} loading={loading} error={error} />
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
