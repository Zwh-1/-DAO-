"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { fetchExplorerStats } from "@/lib/api";

type FlowEntry = { type: "in" | "out"; label: string; amount: string; date: string };

export default function AuditFlowPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchExplorerStats();
      setStats(r);
    } catch { /* graceful */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const MOCK_FLOWS: FlowEntry[] = [
    { type: "in", label: "成员缴费", amount: "12,500", date: "2026-04-20" },
    { type: "in", label: "罚款没收", amount: "200", date: "2026-04-19" },
    { type: "out", label: "理赔赔付 #42", amount: "3,000", date: "2026-04-18" },
    { type: "out", label: "仲裁员奖励", amount: "150", date: "2026-04-18" },
    { type: "in", label: "成员缴费", amount: "8,200", date: "2026-04-15" },
    { type: "out", label: "理赔赔付 #38", amount: "5,500", date: "2026-04-14" },
  ];

  return (
    <RoleGuard required={["guardian", "dao"]} mode="any">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/audit" className="text-steel hover:text-primary text-sm">← 审计仪表盘</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">资金流分析</h1>
            <p className="mt-1 section-desc">追踪平台资金池的流入流出，识别异常大额交易。</p>
          </section>

          <div className="grid grid-cols-3 gap-4">
            {loading ? (
              [1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />)
            ) : (
              [
                ["总流入", String(stats?.totalIn ?? "—"), "text-success"],
                ["总流出", String(stats?.totalOut ?? "—"), "text-alert"],
                ["资金池余额", String(stats?.poolBalance ?? stats?.treasury ?? "—"), "text-primary"],
              ].map(([label, val, cls]) => (
                <div key={label} className="rounded-xl bg-surface/50 border border-gray-100/60 p-4 text-center">
                  <p className="text-xs text-steel mb-1">{label}</p>
                  <p className={`text-xl font-bold ${cls}`}>{val}</p>
                </div>
              ))
            )}
          </div>

          <section className="card">
            <h2 className="section-title mb-4">资金流水（模拟数据）</h2>
            <div className="space-y-2">
              {MOCK_FLOWS.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100/60 p-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${f.type === "in" ? "text-success" : "text-alert"}`}>
                      {f.type === "in" ? "↓" : "↑"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-primary">{f.label}</p>
                      <p className="text-xs text-steel">{f.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${f.type === "in" ? "text-success" : "text-alert"}`}>
                    {f.type === "in" ? "+" : "-"}{f.amount} Token
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-steel/60">* 链上实时数据接入开发中，当前显示模拟记录</p>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
