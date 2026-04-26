"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";
import { toUserErrorMessage } from "@/lib/error-map";
import { queryClaimStatus } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿", submitted: "已提交", public: "公示期",
  challenged: "被挑战", arbitration: "仲裁中", paid: "已赔付", rejected: "已拒绝",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-steel/10 text-steel", submitted: "bg-primary/10 text-primary",
  public: "bg-primary/10 text-primary", challenged: "bg-alert/10 text-alert",
  arbitration: "bg-alert/10 text-alert", paid: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

export default function ClaimListPage() {
  const { isConnected } = useWallet();
  const [claimId, setClaimId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await queryClaimStatus(claimId.trim());
      setResult(r as Record<string, unknown>);
    } catch (e) {
      setError(toUserErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  const status = result?.status as string | undefined;

  return (
    <RoleGuard required="member">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">我的理赔</h1>
                <p className="mt-1 section-desc">输入理赔 ID 查询进度，或前往区块链浏览器查看链上记录。</p>
              </div>
              <Link
                href="/claim"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                + 发起理赔
              </Link>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">理赔状态查询</h2>
            {!isConnected && <p className="text-sm text-steel mb-4">请先连接钱包。</p>}
            <form onSubmit={lookup} className="flex gap-3">
              <input
                type="text"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                placeholder="输入理赔 ID（如 claim-uuid）"
                className="flex-1 rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={loading || !claimId.trim()}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? "查询中…" : "查询"}
              </button>
            </form>

            {error && <p className="mt-3 text-sm text-alert">{error}</p>}

            {result && (
              <div className="mt-4 rounded-xl border border-gray-100/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-steel">理赔 ID: {String(result.claimId ?? claimId)}</p>
                  {status && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? "bg-steel/10 text-steel"}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  )}
                </div>
                {result.amount != null && (
                  <p className="text-sm text-primary font-semibold">金额：{String(result.amount)} USDC</p>
                )}
                <Link href={`/claim/${claimId}`} className="text-xs text-primary underline">
                  查看完整详情 →
                </Link>
              </div>
            )}
          </section>

          <section className="card">
            <div className="flex items-center gap-3 text-sm text-steel">
              <span className="text-2xl">💡</span>
              <p>
                完整理赔历史列表功能正在开发中。如需查询全部记录，可前往
                <Link href="/explorer" className="text-primary underline mx-1">区块链浏览器</Link>
                按地址筛选交易。
              </p>
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
