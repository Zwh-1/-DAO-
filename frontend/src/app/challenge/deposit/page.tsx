"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";

export default function ChallengeDepositPage() {
  const { address, isConnected } = useWallet();
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setOk(null);
    if (!amount || Number(amount) <= 0) {
      setOk(false);
      setMsg("请输入有效的质押金额");
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setOk(true);
      setMsg("质押登记已提交，等待链上确认后生效");
      setAmount("");
      setTxHash("");
    } catch {
      setOk(false);
      setMsg("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard required="challenger">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="card">
            <Link href="/challenge" className="text-steel hover:text-primary text-sm">← 挑战者工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">保证金管理</h1>
            <p className="mt-1 section-desc">
              发起挑战前须在合约中质押保证金；本页面用于登记质押交易与管理余额。
            </p>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">保证金余额</h2>
            {!isConnected ? (
              <p className="text-sm text-steel py-4 text-center">请先连接钱包。</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["可用余额", "0", "text-primary"],
                  ["锁定中", "0", "text-alert"],
                  ["累计质押", "0", "text-steel"],
                ].map(([label, val, cls]) => (
                  <div key={label} className="rounded-xl bg-surface/50 border border-gray-100/60 p-4 text-center">
                    <p className="text-xs text-steel mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                    <p className="text-xs text-steel/60 mt-0.5">Token</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={handleDeposit} className="card space-y-4">
            <h2 className="section-title">质押登记</h2>
            <Input
              label="质押金额（Token）"
              placeholder="例如：100"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              label="链上交易哈希"
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-3 text-xs text-steel">
              请先在链上完成质押操作，再填写交易哈希进行后端登记。最低质押额由合约参数决定。
            </div>
            {msg && <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting || !isConnected}>
              {submitting ? "提交中…" : "登记质押"}
            </Button>
          </form>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">质押记录</h2>
            </div>
            <div className="text-center py-8 text-steel text-sm">
              {!isConnected ? "请先连接钱包" : "暂无质押记录"}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
