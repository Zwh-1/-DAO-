"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { queryClaimStatus } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";

interface ClaimBrief {
  claimId: string;
  status: string;
  amount?: string;
  address?: string;
}

const STATUS_LABEL: Record<string, string> = {
  public: "公示期", challenged: "被挑战", submitted: "已提交",
};
const STATUS_COLOR: Record<string, string> = {
  public: "bg-primary/10 text-primary", challenged: "bg-alert/10 text-alert",
  submitted: "bg-steel/10 text-steel",
};

export default function ChallengeBrowsePage() {
  const [searchId, setSearchId] = useState("");
  const [result, setResult] = useState<ClaimBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await queryClaimStatus(searchId.trim()) as Record<string, unknown>;
      setResult({
        claimId: String(r.claimId ?? searchId),
        status: String(r.status ?? ""),
        amount: r.amount != null ? String(r.amount) : undefined,
        address: r.address != null ? String(r.address) : undefined,
      });
    } catch (e) {
      setError(toUserErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [searchId]);

  return (
    <RoleGuard required="challenger">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/challenge" className="text-steel hover:text-primary text-sm">← 挑战者工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">浏览理赔</h1>
            <p className="mt-1 section-desc">
              查询当前处于「公示期」的理赔申请，在挑战窗口内可对可疑理赔发起挑战。
            </p>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">理赔查询</h2>
            <form onSubmit={search} className="flex gap-3">
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="输入理赔 ID 查询状态"
                className="flex-1 rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={loading || !searchId.trim()}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? "查询中…" : "查询"}
              </button>
            </form>
            {error && <p className="mt-3 text-sm text-alert">{error}</p>}
            {result && (
              <div className="mt-4 rounded-xl border border-gray-100/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">理赔 {result.claimId}</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[result.status] ?? "bg-steel/10 text-steel"}`}>
                    {STATUS_LABEL[result.status] ?? result.status}
                  </span>
                </div>
                {result.amount && <p className="text-sm text-steel">金额: {result.amount} USDC</p>}
                {result.status === "public" && (
                  <Link
                    href={`/challenge?claimId=${result.claimId}`}
                    className="inline-block mt-2 rounded-xl bg-alert/10 border border-alert/30 px-4 py-2 text-sm font-semibold text-alert hover:bg-alert/20 transition-colors"
                  >
                    对此理赔发起挑战 →
                  </Link>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="section-title mb-3">挑战规则</h2>
            <div className="space-y-3 text-sm text-steel">
              {[
                ["公示期", "每笔理赔提交后进入 72 小时公示窗口，挑战者可在此期间质押发起挑战"],
                ["质押要求", "挑战需质押一定数量 Token 作为保证金，若挑战失败则没收"],
                ["奖励机制", "挑战成功后保证金返还并获得奖励；失败则扣除质押"],
                ["仲裁流程", "被挑战理赔进入仲裁，由随机仲裁员裁决"],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span className="font-semibold text-primary w-16 flex-shrink-0">{title}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
