"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { getGuardianAuditLogAdmin } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";
import { Button } from "@/components/ui/Button";

export default function GuardianOplogPage() {
  const [entries, setEntries] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await getGuardianAuditLogAdmin();
      setEntries(r.logs ?? []);
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
            <h1 className="text-2xl font-bold text-primary mt-3">操作日志</h1>
            <p className="mt-1 section-desc">
              所有守护者操作记录，包括参数调整、熔断执行、黑名单操作与角色变更。
            </p>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">审计日志</h2>
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
                {[1,2,3,4].map((i) => <div key={i} className="h-12 rounded-xl bg-surface animate-pulse" />)}
              </div>
            )}
            {!loading && entries.length === 0 && !error && (
              <p className="text-sm text-steel text-center py-8">暂无操作日志</p>
            )}
            <div className="space-y-2">
              {entries.map((entry, i) => {
                const e = entry as Record<string, unknown>;
                return (
                  <div key={i} className="rounded-xl border border-gray-100/60 p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary">
                          {String(e.action ?? e.type ?? "操作")}
                        </p>
                        {e.detail != null && (
                          <p className="text-xs text-steel mt-0.5 line-clamp-1">{String(e.detail)}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {e.operator != null && (
                          <p className="text-xs font-mono text-steel">
                            {String(e.operator).slice(0, 6)}…{String(e.operator).slice(-4)}
                          </p>
                        )}
                        {e.timestamp != null && (
                          <p className="text-xs text-steel/60">
                            {new Date(Number(e.timestamp) * 1000).toLocaleString("zh-CN")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
