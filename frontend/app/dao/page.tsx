"use client";

import { useState } from "react";
import { RoleGuard } from "@/features/governance";
import { Input, Button, PageTransition } from "@/components/ui/index";
import { useAuthStore } from "@/store/authStore";
import { toUserErrorMessage } from "@/lib/error-map";
import {
  useGovernanceProposals,
  useSubmitProposal,
  useVote,
} from "@/hooks/useQueries";

const STATE_LABEL: Record<string, string> = {
  "0": "待定",
  "1": "投票中",
  "2": "通过",
  "3": "否决",
  "4": "排队中",
  "5": "已执行",
  "6": "已取消",
};

const STATE_COLOR: Record<string, string> = {
  "0": "text-steel",
  "1": "text-primary font-semibold",
  "2": "text-success font-semibold",
  "3": "text-alert font-semibold",
  "4": "text-primary",
  "5": "text-success",
  "6": "text-steel line-through",
};

export default function DAOPage() {
  const jwt = useAuthStore((s) => s.token);
  const [activeTab, setActiveTab] = useState<"list" | "propose" | "vote">("list");

  const {
    proposals,
    stats,
    isLoading: listLoading,
    isRefetching,
    error: listError,
    refetch,
  } = useGovernanceProposals({ autoRefresh: true, refreshInterval: 30_000 });

  const [propDesc, setPropDesc] = useState("");
  const [propMsg, setPropMsg] = useState("");
  const [propOk, setPropOk] = useState<boolean | null>(null);

  const { submitProposal, isPending: proposePending } = useSubmitProposal({
    onSuccess: (data) => {
      setPropOk(true);
      setPropMsg(`提案 #${data.proposalId ?? "?"} 已创建，投票开始！`);
      setPropDesc("");
    },
    onError: (err) => {
      setPropOk(false);
      setPropMsg(toUserErrorMessage(err));
    },
  });

  const [voteId, setVoteId] = useState("");
  const [support, setSupport] = useState<"1" | "0" | "2">("1");
  const [voteMsg, setVoteMsg] = useState("");
  const [voteOk, setVoteOk] = useState<boolean | null>(null);

  const { vote, isPending: votePending } = useVote({
    onSuccess: (data) => {
      setVoteOk(true);
      setVoteMsg(`投票成功！累计赞成权重：${(data as Record<string, unknown>).forVotes ?? ""}`);
    },
    onError: (err) => {
      setVoteOk(false);
      setVoteMsg(toUserErrorMessage(err));
    },
  });

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setPropMsg("");
    setPropOk(null);
    if (!propDesc.trim()) {
      setPropMsg("提案描述不能为空");
      setPropOk(false);
      return;
    }
    if (!jwt) {
      setPropOk(false);
      setPropMsg("请先登录（SIWE）");
      return;
    }
    await submitProposal({ description: propDesc.trim() });
  }

  async function handleVote(e: React.FormEvent) {
    e.preventDefault();
    setVoteMsg("");
    setVoteOk(null);
    if (!voteId.trim()) {
      setVoteMsg("请输入提案 ID");
      setVoteOk(false);
      return;
    }
    if (!jwt) {
      setVoteOk(false);
      setVoteMsg("请先登录（SIWE）");
      return;
    }
    await vote({ proposalId: Number(voteId), support: Number(support) });
  }

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t
      ? "border-primary text-primary"
      : "border-transparent text-steel hover:text-primary"
    }`;

  return (
    <RoleGuard required="dao">
    <PageTransition>
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <section className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">DAO 治理看板</h1>
          {stats.total > 0 && (
            <div className="flex gap-3 text-xs">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                共 {stats.total} 项
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                投票中 {stats.active}
              </span>
              <span className="rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                已通过 {stats.passed}
              </span>
            </div>
          )}
        </div>
        <p className="mt-2 section-desc">
          链下提案：<code className="text-xs bg-surface px-1 rounded">/v1/governance/*</code>
          ；链上队列/执行使用 <code className="text-xs bg-surface px-1 rounded">/v1/multisig/governance/*</code>。
        </p>
      </section>

      <div className="flex border-b border-gray-100/60 mb-6">
        <button className={tabCls("list")} onClick={() => setActiveTab("list")}>提案列表</button>
        <button className={tabCls("propose")} onClick={() => setActiveTab("propose")}>发起提案</button>
        <button className={tabCls("vote")} onClick={() => setActiveTab("vote")}>参与投票</button>
      </div>

      {activeTab === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-2 mb-2">
            {isRefetching && <span className="text-xs text-steel animate-pulse">刷新中…</span>}
            <button
              onClick={() => refetch()}
              className="text-sm text-primary underline hover:opacity-80"
            >
              刷新
            </button>
          </div>
          {listLoading && <p className="text-steel text-sm">加载中...</p>}
          {listError && <p className="text-alert text-sm">{toUserErrorMessage(listError)}</p>}
          {!listLoading && proposals.length === 0 && !listError && (
            <div className="card text-center py-12 text-steel text-sm">暂无提案，去发起第一个！</div>
          )}
          {proposals.map((p: { id: number; description: string; state: string; forVotes: string; againstVotes: string; abstainVotes: string }) => (
            <div key={p.id} className="card-compact">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs text-steel mr-2">#{p.id}</span>
                  <span className="text-sm font-semibold text-primary">{p.description}</span>
                </div>
                <span className={`text-xs ${STATE_COLOR[p.state] ?? "text-steel"}`}>
                  {STATE_LABEL[p.state] ?? p.state}
                </span>
              </div>
              <div className="flex gap-6 text-xs text-steel mt-2">
                <span className="text-success">赞成 {p.forVotes}</span>
                <span className="text-alert">反对 {p.againstVotes}</span>
                <span>弃权 {p.abstainVotes}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "propose" && (
        <form onSubmit={handlePropose} className="card space-y-4">
          <div className="rounded-2xl bg-surface/50 border border-gray-100/60 p-4 text-sm text-steel">
            发起提案需持有 SBT 积分（由后端校验）。提案一旦发起，投票期为 <strong className="text-primary">3 天</strong>。
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">提案描述</label>
            <textarea
              className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={4}
              placeholder="请清晰描述本提案的目标、预期效果及执行方式..."
              value={propDesc}
              onChange={e => setPropDesc(e.target.value)}
            />
          </div>
          {propMsg && (
            <p className={`text-sm ${propOk ? "text-success" : "text-alert"}`}>{propMsg}</p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={proposePending}>
            {proposePending ? "提交中…" : "发起提案"}
          </Button>
        </form>
      )}

      {activeTab === "vote" && (
        <form onSubmit={handleVote} className="card space-y-4">
          <Input
            label="提案 ID"
            placeholder="例如：1"
            value={voteId}
            onChange={e => setVoteId(e.target.value)}
            type="number"
          />
          <div>
            <label className="block text-sm font-medium text-primary mb-2">投票意向</label>
            <div className="flex gap-4">
              {([["1", "赞成", "text-success"], ["0", "反对", "text-alert"], ["2", "弃权", "text-steel"]] as const).map(([val, label, cls]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="support"
                    value={val}
                    checked={support === val}
                    onChange={() => setSupport(val)}
                    className="accent-primary"
                  />
                  <span className={`text-sm font-medium ${cls}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {voteMsg && (
            <p className={`text-sm ${voteOk ? "text-success" : "text-alert"}`}>{voteMsg}</p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={votePending}>
            {votePending ? "提交中…" : "提交投票"}
          </Button>
        </form>
      )}

    </div>
    </PageTransition>
    </RoleGuard>
  );
}
