"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";
import { fetchMemberActivity, type ActivityRow } from "@/lib/api";
import { Button } from "@/components/ui/Button";

const ACTION_LABEL: Record<string, string> = {
  payment: "缴费", refund: "退款", claim_paid: "理赔赔付", reward: "奖励发放",
};

export default function MemberPaymentsPage() {
  const { address, isConnected } = useWallet();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!address) { setActivities([]); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMemberActivity(address, page, 20);
      const paymentActions = r.activities.filter(
        (a) => ["payment", "refund", "claim_paid", "reward"].includes(a.action)
      );
      setActivities(paymentActions);
      setTotal(r.total);
    } catch {
      setError("无法加载缴费记录");
    } finally {
      setLoading(false);
    }
  }, [address, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <RoleGuard required="member">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/member/profile" className="text-steel hover:text-primary text-sm">← 个人资料</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">缴费记录</h1>
            <p className="mt-1 section-desc">互助金缴纳记录及理赔赔付历史。</p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">交易流水</h2>
              <Button
                onClick={() => load()}
                disabled={!isConnected || loading}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              >
                刷新
              </Button>
            </div>
            {!isConnected && <p className="text-sm text-steel py-4 text-center">请先连接钱包。</p>}
            {isConnected && loading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
              </div>
            )}
            {isConnected && error && <p className="text-sm text-alert">{error}</p>}
            {isConnected && !loading && activities.length === 0 && !error && (
              <p className="text-sm text-steel text-center py-8">暂无缴费记录</p>
            )}
            <div className="space-y-2">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-gray-100/60 p-3">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {ACTION_LABEL[a.action] ?? a.action}
                    </p>
                    <p className="text-xs text-steel mt-0.5">{a.detail || "—"}</p>
                  </div>
                  <div className="text-right">
                    {a.txHash && (
                      <p className="text-xs font-mono text-steel">
                        {a.txHash.slice(0, 8)}…{a.txHash.slice(-6)}
                      </p>
                    )}
                    <p className="text-xs text-steel/60">
                      {new Date(a.timestamp * 1000).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {total > 20 && (
              <div className="mt-4 flex gap-3 justify-center">
                <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="text-sm text-primary underline disabled:text-steel disabled:no-underline">上一页</Button>
                <span className="text-sm text-steel">第 {page} 页</span>
                <Button onClick={() => setPage((p) => p + 1)} disabled={activities.length < 20}
                  className="text-sm text-primary underline disabled:text-steel disabled:no-underline">下一页</Button>
              </div>
            )}
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
