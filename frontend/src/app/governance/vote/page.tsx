"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";
import { useAuthStore } from "@/store/authStore";
import { toUserErrorMessage } from "@/lib/error-map";
import { useGovernanceProposals, useVote } from "@/hooks/useQueries";

export default function GovernanceVotePage() {
  const jwt = useAuthStore((s) => s.token);
  const { proposals, isLoading } = useGovernanceProposals({ autoRefresh: false });
  const activeProposals = proposals.filter((p: { state: string }) => p.state === "1");

  const [selectedId, setSelectedId] = useState("");
  const [support, setSupport] = useState<"1" | "0" | "2">("1");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);

  const { vote, isPending } = useVote({
    onSuccess: (data) => {
      setOk(true);
      setMsg(`投票成功！累计赞成权重：${(data as Record<string, unknown>).forVotes ?? ""}`);
    },
    onError: (err) => {
      setOk(false);
      setMsg(toUserErrorMessage(err));
    },
  });

  async function handleVote(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setOk(null);
    if (!selectedId.trim()) { setOk(false); setMsg("请选择提案"); return; }
    if (!jwt) { setOk(false); setMsg("请先登录（SIWE）"); return; }
    await vote({ proposalId: Number(selectedId), support: Number(support) });
  }

  return (
    <RoleGuard required="dao">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <div className="flex items-center gap-3 mb-1">
              <Link href="/governance" className="text-steel hover:text-primary text-sm">← 治理中心</Link>
            </div>
            <h1 className="text-2xl font-bold text-primary">投票中心</h1>
            <p className="mt-1 section-desc">对当前进行中的提案进行表决。投票权重 = Token 持仓 × 信用分。</p>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">进行中的提案</h2>
            {isLoading && <p className="text-sm text-steel">加载中...</p>}
            {!isLoading && activeProposals.length === 0 && (
              <div className="text-center py-8 text-steel text-sm">
                <p>当前无进行中的提案</p>
                <Link href="/governance/proposals" className="mt-2 inline-block text-primary underline text-xs">
                  查看全部提案
                </Link>
              </div>
            )}
            <div className="space-y-2">
              {activeProposals.map((p: { id: number; description: string; forVotes: string; againstVotes: string }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(String(p.id))}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    selectedId === String(p.id)
                      ? "border-primary bg-primary/5"
                      : "border-gray-100/60 hover:border-primary/30"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-steel mr-2">#{p.id}</span>
                    <span className="text-xs text-success">赞 {p.forVotes} / 反 {p.againstVotes}</span>
                  </div>
                  <p className="text-sm font-medium text-primary mt-1 line-clamp-2">{p.description}</p>
                </button>
              ))}
            </div>
          </section>

          <form onSubmit={handleVote} className="card space-y-4">
            <Input
              label="提案 ID"
              placeholder="选择上方提案或手动输入 ID"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              type="number"
            />
            <div>
              <label className="block text-sm font-medium text-primary mb-2">投票意向</label>
              <div className="flex gap-6">
                {([["1", "赞成", "text-success"], ["0", "反对", "text-alert"], ["2", "弃权", "text-steel"]] as const).map(([val, label, cls]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="support" value={val} checked={support === val}
                      onChange={() => setSupport(val)} className="accent-primary" />
                    <span className={`text-sm font-medium ${cls}`}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            {msg && <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
              {isPending ? "提交中…" : "提交投票"}
            </Button>
          </form>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
