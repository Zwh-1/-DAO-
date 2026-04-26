"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";
import { fetchMemberReputation } from "@/lib/api";

export default function OracleReputationPage() {
  const { address } = useWallet();
  const [rep, setRep] = useState<{ score: number; breakdown: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const r = await fetchMemberReputation(address);
      setRep(r);
    } catch {
      /* graceful fallback */
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const scoreColor = (s: number) =>
    s >= 80 ? "text-success" : s >= 50 ? "text-primary" : "text-alert";

  return (
    <RoleGuard required="oracle">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/oracle" className="text-steel hover:text-primary text-sm">← 预言机工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">信誉系统</h1>
            <p className="mt-1 section-desc">
              预言机信誉由数据准确率、签名及时率与历史一致率综合计算，影响质押倍率与奖励分配。
            </p>
          </section>

          {!address && (
            <div className="card text-sm text-steel text-center py-8">请先连接钱包以查看信誉数据。</div>
          )}
          {address && loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-surface animate-pulse" />)}
            </div>
          )}

          {rep && (
            <>
              <section className="card">
                <h2 className="section-title mb-4">综合信誉分</h2>
                <div className="flex items-center gap-6">
                  <div className={`text-6xl font-black ${scoreColor(rep.score)}`}>{rep.score}</div>
                  <div>
                    <p className={`text-sm font-semibold ${scoreColor(rep.score)}`}>
                      {rep.score >= 80 ? "可信预言机" : rep.score >= 50 ? "一般" : "风险预警"}
                    </p>
                    <p className="text-xs text-steel mt-1">影响奖励倍率与任务分配权重</p>
                  </div>
                </div>
              </section>
              <section className="card">
                <h2 className="section-title mb-4">分项明细</h2>
                <div className="space-y-3">
                  {Object.entries(rep.breakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-steel w-36 flex-shrink-0">{key}</span>
                      <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, val)}%` }} />
                      </div>
                      <span className={`text-sm font-semibold w-10 text-right ${scoreColor(val)}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {!rep && !loading && address && (
            <section className="card space-y-4">
              <h2 className="section-title">评分维度说明</h2>
              {[
                ["数据准确率", "提交数据与最终共识一致的比率"],
                ["签名及时率", "在截止时间前完成签名的比率"],
                ["历史一致率", "报告最终被采纳为有效的比率"],
                ["Slashing 记录", "被没收质押的次数，每次扣减信誉分"],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl bg-surface/50 border border-gray-100/60 p-3">
                  <p className="text-sm font-semibold text-primary">{title}</p>
                  <p className="text-xs text-steel mt-0.5">{desc}</p>
                </div>
              ))}
            </section>
          )}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
