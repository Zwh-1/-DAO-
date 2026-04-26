"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/auth";
import { Button, PageTransition } from "@/components/ui/index";
import { useAuthStore } from "@/store/authStore";
import { toUserErrorMessage } from "@/lib/error-map";
import { useVote } from "@/hooks/useQueries";

const STATE_LABEL: Record<string, string> = {
  "0": "待定", "1": "投票中", "2": "通过", "3": "否决",
  "4": "排队中", "5": "已执行", "6": "已取消",
};

const STATE_COLOR: Record<string, string> = {
  "0": "bg-steel/10 text-steel",
  "1": "bg-primary/10 text-primary",
  "2": "bg-success/10 text-success",
  "3": "bg-alert/10 text-alert",
  "4": "bg-primary/10 text-primary",
  "5": "bg-success/10 text-success",
  "6": "bg-steel/10 text-steel",
};

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jwt = useAuthStore((s) => s.token);
  const [support, setSupport] = useState<"1" | "0" | "2">("1");
  const [voteMsg, setVoteMsg] = useState("");
  const [voteOk, setVoteOk] = useState<boolean | null>(null);
  const [voted, setVoted] = useState(false);

  const { vote, isPending } = useVote({
    onSuccess: (data) => {
      setVoteOk(true);
      setVoteMsg(`投票成功！累计赞成权重：${(data as Record<string, unknown>).forVotes ?? ""}`);
      setVoted(true);
    },
    onError: (err) => {
      setVoteOk(false);
      setVoteMsg(toUserErrorMessage(err));
    },
  });

  async function handleVote(e: React.FormEvent) {
    e.preventDefault();
    setVoteMsg("");
    setVoteOk(null);
    if (!jwt) { setVoteOk(false); setVoteMsg("请先登录（SIWE）"); return; }
    await vote({ proposalId: Number(id), support: Number(support) });
  }

  return (
    <RoleGuard required="dao">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/governance/proposals" className="text-steel hover:text-primary text-sm">
              ← 提案大厅
            </Link>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs text-steel mr-2">#{id}</span>
                <h1 className="text-xl font-bold text-primary mt-1">提案详情</h1>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATE_COLOR["1"]}`}>
                {STATE_LABEL["1"]}
              </span>
            </div>
          </section>

          <section className="card space-y-4">
            <h2 className="section-title">状态机</h2>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {["待定", "投票中", "通过/否决", "排队中", "已执行"].map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 font-medium ${i === 1 ? "bg-primary text-white" : "bg-surface text-steel"}`}>{s}</span>
                  {i < 4 && <span className="text-steel">→</span>}
                </span>
              ))}
            </div>
          </section>

          <section className="card space-y-3">
            <h2 className="section-title">投票数据</h2>
            <div className="grid grid-cols-3 gap-4">
              {[["赞成", "0", "text-success"], ["反对", "0", "text-alert"], ["弃权", "0", "text-steel"]].map(([label, val, cls]) => (
                <div key={label} className="rounded-xl bg-surface/50 border border-gray-100/60 p-4 text-center">
                  <p className="text-xs text-steel mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
          </section>

          {!voted && (
            <form onSubmit={handleVote} className="card space-y-4">
              <h2 className="section-title">参与投票</h2>
              <div className="flex gap-4">
                {([["1", "赞成", "text-success"], ["0", "反对", "text-alert"], ["2", "弃权", "text-steel"]] as const).map(([val, label, cls]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="support" value={val} checked={support === val}
                      onChange={() => setSupport(val)} className="accent-primary" />
                    <span className={`text-sm font-medium ${cls}`}>{label}</span>
                  </label>
                ))}
              </div>
              {voteMsg && <p className={`text-sm ${voteOk ? "text-success" : "text-alert"}`}>{voteMsg}</p>}
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
                {isPending ? "提交中…" : "提交投票"}
              </Button>
            </form>
          )}
          {voted && (
            <div className="card text-center py-8 text-success font-semibold">
              ✓ 已成功投票
            </div>
          )}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
