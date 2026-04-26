"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";

export default function GovernanceDelegatePage() {
  const { address } = useWallet();
  const [delegateTo, setDelegateTo] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelegate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setOk(null);
    if (!delegateTo.trim() || !/^0x[0-9a-fA-F]{40}$/.test(delegateTo.trim())) {
      setOk(false);
      setMsg("请输入有效的以太坊地址");
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setOk(true);
      setMsg(`已委托投票权给 ${delegateTo.trim().slice(0, 6)}...${delegateTo.trim().slice(-4)}`);
    } catch {
      setOk(false);
      setMsg("委托失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke() {
    setMsg("");
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setOk(true);
      setMsg("已撤销委托，投票权已归还至本地址");
      setDelegateTo("");
    } catch {
      setOk(false);
      setMsg("撤销失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard required="dao">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="card">
            <Link href="/governance" className="text-steel hover:text-primary text-sm">← 治理中心</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">委托投票</h1>
            <p className="mt-1 section-desc">
              将您的投票权委托给信任的地址，委托人可代您对提案进行表决。您可随时撤销委托。
            </p>
          </section>

          <section className="card space-y-4">
            <h2 className="section-title">当前委托状态</h2>
            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-4">
              <p className="text-xs text-steel mb-1">您的地址</p>
              <p className="text-sm font-mono text-primary">{address ?? "—"}</p>
              <p className="text-xs text-steel mt-3 mb-1">当前委托给</p>
              <p className="text-sm font-medium text-steel">未委托（自行投票）</p>
            </div>
          </section>

          <form onSubmit={handleDelegate} className="card space-y-4">
            <h2 className="section-title">设置委托</h2>
            <Input
              label="委托地址"
              placeholder="0x..."
              value={delegateTo}
              onChange={(e) => setDelegateTo(e.target.value)}
            />
            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-3 text-xs text-steel">
              委托后，被委托人将代您进行投票；您的代币仍留在您的钱包中，委托只影响投票权。
            </div>
            {msg && <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>}
            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={submitting}>
                {submitting ? "处理中…" : "确认委托"}
              </Button>
              <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={handleRevoke} disabled={submitting}>
                撤销委托
              </Button>
            </div>
          </form>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
