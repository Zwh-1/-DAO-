"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";

export default function GuardianUpgradePage() {
  const [contractName, setContractName] = useState("");
  const [newImpl, setNewImpl] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setOk(null);
    if (!contractName.trim() || !newImpl.trim()) {
      setOk(false); setMsg("请填写合约名称和新实现地址"); return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setOk(true);
      setMsg("升级提案已提交至 DAO 治理队列，等待投票通过后 Timelock 执行。");
      setContractName(""); setNewImpl(""); setReason("");
    } catch {
      setOk(false); setMsg("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const CONTRACTS = [
    { name: "ClaimManager", proxy: "0x0000...（未配置）", version: "v1.0.0" },
    { name: "ArbitrationPool", proxy: "0x0000...（未配置）", version: "v1.0.0" },
    { name: "Treasury", proxy: "0x0000...（未配置）", version: "v1.0.0" },
    { name: "PlatformRoleRegistry", proxy: "0x0000...（未配置）", version: "v1.0.0" },
  ];

  return (
    <RoleGuard required="guardian">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/guardian" className="text-steel hover:text-primary text-sm">← 守护者控制台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">合约升级</h1>
            <p className="mt-1 section-desc">
              所有升级均通过透明代理模式执行，需提交 DAO 提案并经 Timelock 延迟后生效。
            </p>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">已部署合约</h2>
            <div className="space-y-2">
              {CONTRACTS.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-xl border border-gray-100/60 p-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">{c.name}</p>
                    <p className="text-xs font-mono text-steel mt-0.5">{c.proxy}</p>
                  </div>
                  <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">{c.version}</span>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="section-title">提交升级提案</h2>
            <Input
              label="合约名称"
              placeholder="例如：ClaimManager"
              value={contractName}
              onChange={(e) => setContractName(e.target.value)}
            />
            <Input
              label="新实现合约地址"
              placeholder="0x..."
              value={newImpl}
              onChange={(e) => setNewImpl(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-primary mb-1">升级原因</label>
              <textarea
                className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                placeholder="描述此次升级的目的与变更内容..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="rounded-xl bg-alert/5 border border-alert/20 p-3 text-xs text-alert">
              ⚠️ 合约升级为高风险操作，提案提交后须经 DAO 投票通过，并等待 48 小时 Timelock 后方可执行。
            </div>
            {msg && <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "提交中…" : "提交升级提案"}
            </Button>
          </form>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
