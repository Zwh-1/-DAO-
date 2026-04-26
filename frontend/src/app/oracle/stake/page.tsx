"use client";

import Link from "next/link";
import { useState } from "react";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";

export default function OracleStakePage() {
  const { address, isConnected } = useWallet();
  const [stakeAmount, setStakeAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleStake(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setOk(null);
    if (!stakeAmount || Number(stakeAmount) <= 0) {
      setOk(false); setMsg("请输入有效质押金额"); return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setOk(true);
      setMsg("质押登记成功，等待链上确认");
      setStakeAmount(""); setTxHash("");
    } catch {
      setOk(false); setMsg("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard required="oracle">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="card">
            <Link href="/oracle" className="text-steel hover:text-primary text-sm">← 预言机工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">质押管理</h1>
            <p className="mt-1 section-desc">
              预言机须质押一定数量 Token 作为诚信保证；恶意报告将导致质押被没收（Slashing）。
            </p>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">质押概览</h2>
            {!isConnected ? (
              <p className="text-sm text-steel text-center py-6">请先连接钱包。</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["当前质押", "0", "text-primary"],
                  ["最低要求", "1000", "text-steel"],
                  ["已被没收", "0", "text-alert"],
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

          <form onSubmit={handleStake} className="card space-y-4">
            <h2 className="section-title">增加质押</h2>
            <Input
              label="质押金额（Token）"
              placeholder="最低 1000 Token"
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />
            <Input
              label="链上交易哈希"
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-3 text-xs text-steel">
              请先在链上完成质押，再填写 TxHash 进行后端登记。质押期间须保持活跃数据提交，低于最低质押将暂停 Oracle 资格。
            </div>
            {msg && <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting || !isConnected}>
              {submitting ? "提交中…" : "登记质押"}
            </Button>
          </form>

          <section className="card">
            <h2 className="section-title mb-3">质押规则</h2>
            <div className="space-y-2 text-sm text-steel">
              {[
                ["最低质押", "1000 Token，低于此值暂停数据提交资格"],
                ["Slashing 触发", "提交与多数签名不一致的数据超过 3 次"],
                ["退出机制", "申请退出后进入 7 天冷却期，之后可提取"],
                ["奖励加成", "质押越高，每次有效签名奖励倍率越高"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="font-semibold text-primary w-24 flex-shrink-0">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
