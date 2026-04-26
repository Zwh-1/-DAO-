"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { listOracleReports, type OracleReportSummary } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";
import { Button } from "@/components/ui/Button";

export default function GuardianOraclePage() {
  const [reports, setReports] = useState<OracleReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await listOracleReports({ page: 1, limit: 20 });
      setReports(r.reports ?? []);
    } catch (e) {
      setError(toUserErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <RoleGuard required="guardian">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/guardian" className="text-steel hover:text-primary text-sm">← 守护者控制台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">预言机管理</h1>
            <p className="mt-1 section-desc">监控预言机报告状态，对异常预言机执行暂停或移除操作。</p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">最近报告</h2>
              <Button
                onClick={() => load()}
                disabled={loading}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
              >
                {loading ? "刷新中…" : "刷新"}
              </Button>
            </div>
            {error && <p className="text-sm text-alert mb-3">{error}</p>}
            {loading && (
              <div className="space-y-2">
                {[1,2,3].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
              </div>
            )}
            {!loading && reports.length === 0 && !error && (
              <p className="text-sm text-steel text-center py-8">暂无预言机报告</p>
            )}
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.reportId} className="rounded-xl border border-gray-100/60 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-steel">报告 {r.reportId}</p>
                      <p className="text-sm font-medium text-primary mt-0.5">理赔 {r.claimId}</p>
                      <p className="text-xs font-mono text-steel/70 mt-0.5 truncate">{r.dataHashPreview}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.finalized ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                        {r.finalized ? "已终结" : "进行中"}
                      </span>
                      <span className="text-xs text-steel">{r.signatures} 签名</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title mb-3">管理操作</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "暂停异常预言机", desc: "临时冻结指定 Oracle 的提交资格", color: "text-alert", border: "border-alert/20" },
                { label: "强制终结报告", desc: "手动将卡住的报告强制推进至终结状态", color: "text-primary", border: "border-primary/20" },
                { label: "更新最低质押", desc: "调整 Oracle 最低质押要求（需 DAO 批准）", color: "text-steel", border: "border-gray-200" },
                { label: "查看信誉榜", desc: "按信誉分排序查看所有活跃预言机", color: "text-steel", border: "border-gray-200" },
              ].map((op) => (
                <Button key={op.label} type="button"
                  className={`text-left rounded-xl border ${op.border} p-4 hover:bg-surface/50 transition-colors opacity-70 cursor-not-allowed`}>
                  <p className={`text-sm font-semibold ${op.color}`}>{op.label}</p>
                  <p className="text-xs text-steel mt-1">{op.desc}</p>
                </Button>
              ))}
            </div>
            <p className="text-xs text-steel mt-3">链上执行功能开发中</p>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
