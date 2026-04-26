"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listMyChallenges, type ChallengeRecord } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";
import { RoleGuard } from "@/components/auth";
import { useWallet } from "@/features/wallet";
import { PageTransition } from "@/components/ui/index";
import { ChallengeList, CreateChallengeForm } from "@/features/workbench/challenger";

export default function ChallengePage() {
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
      <PageTransition>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="card">
          <h1 className="text-xl font-bold text-primary">异议挑战者工作台</h1>
          <p className="mt-2 section-desc">
            发起挑战需登录并具备挑战者角色；质押与链上哈希由您本地填写后提交后端登记。
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/challenge/browse" className="font-semibold text-primary underline">
              浏览理赔
            </Link>
            <Link href="/challenge/list" className="font-semibold text-primary underline">
              我的挑战
            </Link>
            <Link href="/challenge/deposit" className="font-semibold text-primary underline">
              保证金管理
            </Link>
          </div>
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
          {!isConnected && <p className="text-sm text-steel">连接钱包后可加载与您地址关联的挑战记录。</p>}
          {isConnected && address && (
            <ChallengeList challenges={challenges} loading={loading} error={error} />
          )}
        </section>

        <CreateChallengeForm defaultChallenger={address} onSuccess={() => refresh()} />
      </div>
      </PageTransition>
    </RoleGuard>
  );
}
