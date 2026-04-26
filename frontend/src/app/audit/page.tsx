"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { fetchExplorerStats } from "@/lib/api";

export default function AuditDashboardPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchExplorerStats();
      setStats(r);
    } catch {
      /* graceful fallback */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const QUICK_LINKS = [
    { href: "/audit/flow", label: "资金流分析", icon: "💸", desc: "追踪资金流入流出" },
    { href: "/audit/fraud", label: "欺诈检测", icon: "🔍", desc: "异常模式识别与预警" },
    { href: "/audit/reports", label: "历史报告", icon: "📁", desc: "查阅已发布审计报告" },
    { href: "/audit/publish", label: "发布报告", icon: "📤", desc: "生成并发布审计报告" },
  ];

  return (
    <RoleGuard required={["guardian", "dao"]} mode="any">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <section className="card">
            <h1 className="text-2xl font-bold text-primary">审计仪表盘</h1>
            <p className="mt-1 section-desc">
              平台资金、理赔与角色权限的全局审计视图，仅守护者与 DAO 成员可访问。
            </p>
          </section>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="card hover:border-primary/40 transition-colors group"
              >
                <span className="text-3xl">{l.icon}</span>
                <p className="mt-2 text-sm font-semibold text-primary group-hover:underline">{l.label}</p>
                <p className="text-xs text-steel mt-0.5">{l.desc}</p>
              </Link>
            ))}
          </div>

          <section className="card">
            <h2 className="section-title mb-4">平台概览数据</h2>
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />)}
              </div>
            )}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {([
                  ["总交易数", String(stats.totalTx ?? stats.transactions ?? "—")],
                  ["活跃成员", String(stats.totalMembers ?? stats.members ?? "—")],
                  ["理赔总数", String(stats.totalClaims ?? stats.claims ?? "—")],
                  ["资金池余额", String(stats.poolBalance ?? stats.treasury ?? "—")],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-surface/50 border border-gray-100/60 p-4 text-center">
                    <p className="text-xs text-steel mb-1">{label}</p>
                    <p className="text-xl font-bold text-primary">{val}</p>
                  </div>
                ))}
              </div>
            )}
            {!loading && !stats && (
              <p className="text-sm text-steel text-center py-6">数据暂不可用</p>
            )}
          </section>

          <section className="card">
            <h2 className="section-title mb-3">最近审计事件</h2>
            <div className="text-center py-8 text-steel text-sm">
              <p>暂无审计事件记录</p>
              <Link href="/audit/reports" className="mt-2 inline-block text-primary underline text-xs">
                查看历史报告
              </Link>
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
