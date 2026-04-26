"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";

type RiskLevel = "high" | "medium" | "low";
interface AnomalyEntry {
  id: string;
  type: string;
  address: string;
  detail: string;
  risk: RiskLevel;
  time: string;
}

const MOCK_ANOMALIES: AnomalyEntry[] = [
  { id: "A001", type: "频繁理赔", address: "0xaBcD…1234", detail: "30天内提交 5 次理赔，超出正常阈值", risk: "high", time: "2026-04-21" },
  { id: "A002", type: "身份重复", address: "0x5678…EfGh", detail: "Nullifier Hash 与已通过申请存在碰撞风险", risk: "high", time: "2026-04-20" },
  { id: "A003", type: "异常质押", address: "0x9999…aBcD", detail: "挑战质押额远低于历史平均，疑似测试攻击", risk: "medium", time: "2026-04-19" },
  { id: "A004", type: "地址聚集", address: "0x1111…5555", detail: "同 IP 段注册多个地址，可能 Sybil 攻击", risk: "medium", time: "2026-04-18" },
  { id: "A005", type: "小额频刷", address: "0x2222…6666", detail: "连续发起小额理赔试探系统下限", risk: "low", time: "2026-04-17" },
];

const RISK_COLOR: Record<RiskLevel, string> = {
  high: "bg-danger/10 text-danger border-danger/20",
  medium: "bg-alert/10 text-alert border-alert/20",
  low: "bg-steel/10 text-steel border-steel/20",
};
const RISK_LABEL: Record<RiskLevel, string> = { high: "高风险", medium: "中风险", low: "低风险" };

export default function AuditFraudPage() {
  const [filter, setFilter] = useState<RiskLevel | "all">("all");

  const filtered = filter === "all" ? MOCK_ANOMALIES : MOCK_ANOMALIES.filter((a) => a.risk === filter);

  return (
    <RoleGuard required={["guardian", "dao"]} mode="any">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="card">
            <Link href="/audit" className="text-steel hover:text-primary text-sm">← 审计仪表盘</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">欺诈检测</h1>
            <p className="mt-1 section-desc">
              基于规则引擎识别的异常行为。高风险项目应尽快核查，必要时加入黑名单。
            </p>
          </section>

          <div className="grid grid-cols-3 gap-4">
            {(["high", "medium", "low"] as RiskLevel[]).map((r) => {
              const count = MOCK_ANOMALIES.filter((a) => a.risk === r).length;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFilter(filter === r ? "all" : r)}
                  className={`rounded-xl border p-4 text-center transition-colors ${filter === r ? RISK_COLOR[r] : "border-gray-100/60 hover:border-primary/30"}`}
                >
                  <p className="text-2xl font-black">{count}</p>
                  <p className="text-xs mt-1">{RISK_LABEL[r]}</p>
                </button>
              );
            })}
          </div>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">异常列表</h2>
              <span className="text-xs text-steel">{filtered.length} 条 · 模拟数据</span>
            </div>
            <div className="space-y-3">
              {filtered.map((a) => (
                <div key={a.id} className={`rounded-xl border p-4 ${RISK_COLOR[a.risk]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono">{a.id}</span>
                        <span className="text-sm font-semibold">{a.type}</span>
                      </div>
                      <p className="text-xs font-mono opacity-70">{a.address}</p>
                      <p className="text-xs mt-1 opacity-80">{a.detail}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs">{a.time}</span>
                      <Link
                        href="/guardian/blacklist"
                        className="rounded-lg border border-current px-3 py-1 text-xs font-semibold hover:opacity-80 transition-opacity"
                      >
                        加入黑名单
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
