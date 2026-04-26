"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGuard } from "@/components/auth";
import { Button, PageTransition } from "@/components/ui/index";

interface Param {
  key: string;
  label: string;
  value: string;
  unit: string;
  pendingValue?: string;
  daoRequired: boolean;
}

const PARAMS: Param[] = [
  { key: "maxClaimRatio", label: "最大理赔比例", value: "80", unit: "%", daoRequired: true },
  { key: "waitingPeriod", label: "等待期（天）", value: "7", unit: "天", daoRequired: true },
  { key: "challengeWindow", label: "挑战窗口（小时）", value: "72", unit: "小时", daoRequired: false },
  { key: "minArbitrators", label: "最低仲裁员数", value: "3", unit: "人", daoRequired: true },
  { key: "slashThreshold", label: "Slash 触发次数", value: "3", unit: "次", daoRequired: false },
  { key: "oracleMinStake", label: "Oracle 最低质押", value: "1000", unit: "Token", daoRequired: true },
];

export default function GuardianParamsPage() {
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);

  function startEdit(p: Param) {
    setEditing(p.key);
    setEditVal(p.value);
    setMsg("");
    setOk(null);
  }

  async function handleSave(p: Param) {
    if (!editVal.trim()) return;
    if (p.daoRequired) {
      setOk(false);
      setMsg(`修改「${p.label}」需通过 DAO 提案执行，请前往治理中心发起提案。`);
      setEditing(null);
      return;
    }
    try {
      await new Promise((r) => setTimeout(r, 500));
      setOk(true);
      setMsg(`参数「${p.label}」已更新为 ${editVal} ${p.unit}`);
    } catch {
      setOk(false);
      setMsg("更新失败，请稍后重试");
    } finally {
      setEditing(null);
    }
  }

  return (
    <RoleGuard required="guardian">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/guardian" className="text-steel hover:text-primary text-sm">← 守护者控制台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">参数管理</h1>
            <p className="mt-1 section-desc">
              系统运行参数。标注「需 DAO」的参数需通过 Timelock 提案执行，其余可直接由守护者调整。
            </p>
          </section>

          {msg && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${ok ? "border-success/30 bg-success/5 text-success" : "border-alert/30 bg-alert/5 text-alert"}`}>
              {msg}
            </div>
          )}

          <section className="card">
            <div className="space-y-0 divide-y divide-gray-100/60">
              {PARAMS.map((p) => (
                <div key={p.key} className="flex items-center justify-between py-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-primary">{p.label}</p>
                      {p.daoRequired && (
                        <span className="rounded-full bg-steel/10 px-2 py-0.5 text-xs text-steel">需 DAO</span>
                      )}
                    </div>
                    <p className="text-xs text-steel mt-0.5 font-mono">{p.key}</p>
                  </div>
                  {editing === p.key ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={p.unit}
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        className="w-24 rounded-lg border border-primary px-2 py-1 text-sm text-primary focus:outline-none"
                        autoFocus
                      />
                      <span className="text-xs text-steel">{p.unit}</span>
                      <Button size="sm" variant="primary" onClick={() => handleSave(p)}>保存</Button>
                      <Button onClick={() => setEditing(null)} className="text-sm text-steel hover:text-primary">取消</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-primary">{p.value} <span className="font-normal text-steel text-xs">{p.unit}</span></span>
                      <Button
                        onClick={() => startEdit(p)}
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-primary hover:bg-surface/80"
                      >
                        修改
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="card text-sm text-steel flex gap-3 items-start">
            <span className="text-xl">⚠️</span>
            <p>参数变更将实时影响系统行为；标注「需 DAO」的参数实际修改须经治理提案并等待 Timelock 延迟执行。</p>
          </div>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
