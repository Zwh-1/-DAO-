"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";
import { fetchMemberActivity, type ActivityRow } from "@/lib/api";
import { ACTION_ICON } from "@/types/member";
import { Button } from "@/components/ui/Button";
export default function MemberNotificationsPage() {
  const { address, isConnected } = useWallet();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) { setActivities([]); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMemberActivity(address, 1, 30);
      setActivities(r.activities);
    } catch {
      setError("无法加载通知");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  return (
    <RoleGuard required="member">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/member/profile" className="text-steel hover:text-primary text-sm">← 个人资料</Link>
            <div className="mt-3 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-primary">通知中心</h1>
              {activities.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {activities.length} 条
                </span>
              )}
            </div>
            <p className="mt-1 section-desc">账户相关事件通知与活动记录。</p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">最新通知</h2>
              <Button
                onClick={() => load()}
                disabled={!isConnected || loading}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              >
                刷新
              </Button>
            </div>
            {!isConnected && <p className="text-sm text-steel py-6 text-center">请先连接钱包。</p>}
            {isConnected && loading && (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
              </div>
            )}
            {isConnected && error && <p className="text-sm text-alert">{error}</p>}
            {isConnected && !loading && activities.length === 0 && !error && (
              <p className="text-sm text-steel text-center py-8">暂无通知</p>
            )}
            <div className="space-y-2">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-gray-100/60 p-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">
                    {ACTION_ICON[a.action] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{a.action}</p>
                    <p className="text-xs text-steel mt-0.5 line-clamp-2">{a.detail || "—"}</p>
                  </div>
                  <p className="text-xs text-steel/60 whitespace-nowrap flex-shrink-0">
                    {new Date(a.timestamp * 1000).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
