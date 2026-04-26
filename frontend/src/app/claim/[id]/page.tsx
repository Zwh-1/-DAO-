"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { queryClaimStatus } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";

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

const STEPS = ["草稿", "已提交", "公示期", "仲裁中", "赔付完成"];

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await queryClaimStatus(id);
      setData(r as Record<string, unknown>);
    } catch (e) {
      setError(toUserErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const status = data?.status as string | undefined;
  const stepIndex = status
    ? ["draft", "submitted", "public", "arbitration", "paid"].indexOf(status)
    : -1;

  return (
    <RoleGuard required="member">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/claim/list" className="text-steel hover:text-primary text-sm">← 我的理赔</Link>
            <div className="mt-3 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-primary">理赔详情</h1>
              {status && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[status] ?? "bg-steel/10 text-steel"}`}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              )}
            </div>
            <p className="text-xs text-steel mt-1">ID: {id}</p>
          </section>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />)}
            </div>
          )}
          {error && (
            <div className="card text-alert text-sm">{error}</div>
          )}

          {data && (
            <>
              <section className="card space-y-4">
                <h2 className="section-title">进度追踪</h2>
                <div className="flex items-center gap-0">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                      <div className={`flex flex-col items-center gap-1 ${i <= stepIndex ? "text-primary" : "text-steel"}`}>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                          i < stepIndex ? "bg-primary border-primary text-white" :
                          i === stepIndex ? "border-primary text-primary" :
                          "border-gray-200 text-steel"
                        }`}>
                          {i < stepIndex ? "✓" : i + 1}
                        </div>
                        <span className="text-xs whitespace-nowrap hidden sm:block">{s}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 ${i < stepIndex ? "bg-primary" : "bg-gray-100"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="card space-y-3">
                <h2 className="section-title">基本信息</h2>
                {[
                  ["理赔 ID", String(data.claimId ?? id)],
                  ["申请金额", data.amount != null ? `${String(data.amount)} USDC` : "—"],
                  ["申请人", String(data.address ?? "—")],
                  ["状态", STATUS_LABEL[status ?? ""] ?? (status ?? "—")],
                  ["IPFS 证据", String(data.evidenceCid ?? "—")],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2 border-b border-gray-100/60 last:border-0">
                    <span className="text-sm text-steel flex-shrink-0">{label}</span>
                    <span className="text-sm text-primary font-medium text-right break-all">{value}</span>
                  </div>
                ))}
              </section>

              {data.nullifierHash != null && (
                <section className="card">
                  <h2 className="section-title mb-2">零知识证明</h2>
                  <p className="text-xs font-mono text-steel break-all">{String(data.nullifierHash)}</p>
                </section>
              )}
            </>
          )}

          <div className="flex gap-3 text-sm">
            <Link href="/claim/list" className="text-steel hover:text-primary underline">← 返回列表</Link>
            <button onClick={() => load()} className="text-primary underline hover:opacity-80">刷新</button>
          </div>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
