"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";
import { fetchMemberReputation } from "@/lib/api";

export default function ArbitrationReputationPage() {
  const { address } = useWallet();
  const [rep, setRep] = useState<{ score: number; breakdown: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMemberReputation(address);
      setRep(r);
    } catch {
      setError("无法加载声誉数据");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const scoreColor = (s: number) =>
    s >= 80 ? "text-success" : s >= 50 ? "text-primary" : "text-alert";

  return (
    <RoleGuard required="arbitrator">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/arbitration" className="text-steel hover:text-primary text-sm">← 仲裁工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">声誉系统</h1>
            <p className="mt-1 section-desc">
              仲裁员声誉由投票一致率、裁决质量与历史记录综合计算。声誉影响随机选案权重。
            </p>
          </section>

          {!address && (
            <div className="card text-sm text-steel text-center py-8">请先连接钱包以查看声誉数据。</div>
          )}

          {address && loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />)}
            </div>
          )}
          {address && error && <div className="card text-sm text-alert">{error}</div>}

          {rep && (
            <>
              <section className="card">
                <h2 className="section-title mb-4">综合信用分</h2>
                <div className="flex items-center gap-6">
                  <div className={`text-6xl font-black ${scoreColor(rep.score)}`}>
                    {rep.score}
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-steel">
                    <span className={rep.score >= 80 ? "text-success font-semibold" : rep.score >= 50 ? "text-primary" : "text-alert font-semibold"}>
                      {rep.score >= 80 ? "优秀" : rep.score >= 50 ? "良好" : "需改进"}
                    </span>
                    <span className="text-xs">影响随机选案权重与质押倍率</span>
                  </div>
                </div>
              </section>

              <section className="card">
                <h2 className="section-title mb-4">分项明细</h2>
                <div className="space-y-3">
                  {Object.entries(rep.breakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-steel w-32 flex-shrink-0">{key}</span>
                      <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, val)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-10 text-right ${scoreColor(val)}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {!rep && !loading && address && !error && (
            <div className="card space-y-4">
              <h2 className="section-title">声誉指标说明</h2>
              {[
                ["投票一致率", "与多数仲裁员裁决一致的比例，越高越好"],
                ["恶意投票记录", "被惩罚的裁决次数，影响信用扣分"],
                ["参与活跃度", "按时完成 Commit/Reveal 的频率"],
                ["历史准确率", "最终判决结果与您投票一致的比率"],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl bg-surface/50 border border-gray-100/60 p-3">
                  <p className="text-sm font-semibold text-primary">{title}</p>
                  <p className="text-xs text-steel mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
