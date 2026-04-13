"use client";

import { useState, useEffect } from "react";
import { RoleGuard } from "../../components/auth/RoleGuard";
import { Input, Button } from "../../components/ui/index";

interface Proposal {
  id: number;
  description: string;
  proposer: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  state: string;
  endTime: number;
}

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
  const [activeTab, setActiveTab] = useState<"list" | "propose" | "vote">("list");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [listMsg, setListMsg] = useState("");

  // Propose
  const [propDesc, setPropDesc] = useState("");
  const [propMsg, setPropMsg] = useState("");
  const [propOk, setPropOk] = useState<boolean | null>(null);

  // Vote
  const [voteId, setVoteId] = useState("");
  const [support, setSupport] = useState<"1" | "0" | "2">("1");
  const [voteMsg, setVoteMsg] = useState("");
  const [voteOk, setVoteOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (activeTab === "list") fetchProposals();
  }, [activeTab]);

  async function fetchProposals() {
    setLoading(true);
    setListMsg("");
    try {
      const res = await fetch("/v1/governance/proposals");
      const data = await res.json();
      if (res.ok) {
        setProposals(data.proposals ?? []);
      } else {
        setListMsg(data.error ?? "获取提案列表失败");
      }
    } catch {
      setListMsg("网络错误，请检查后端服务");
    } finally {
      setLoading(false);
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setPropMsg("");
    setPropOk(null);
    if (!propDesc.trim()) {
      setPropMsg("提案描述不能为空");
      setPropOk(false);
      return;
    }
    try {
      const token = localStorage.getItem("jwt") ?? "";
      const res = await fetch("/v1/governance/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: propDesc }),
      });
      const data = await res.json();
      if (res.ok) {
        setPropOk(true);
        setPropMsg(`提案 #${data.proposalId} 已创建，投票开始！`);
        setPropDesc("");
      } else {
        setPropOk(false);
        setPropMsg(data.error ?? "提案失败");
      }
    } catch {
      setPropOk(false);
      setPropMsg("网络错误");
    }
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
    try {
      const token = localStorage.getItem("jwt") ?? "";
      const res = await fetch("/v1/governance/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ proposalId: Number(voteId), support: Number(support) }),
      });
      const data = await res.json();
      if (res.ok) {
        setVoteOk(true);
        setVoteMsg(`投票成功！累计赞成权重：${data.forVotes}`);
      } else {
        setVoteOk(false);
        setVoteMsg(data.error ?? "投票失败");
      }
    } catch {
      setVoteOk(false);
      setVoteMsg("网络错误");
    }
  }

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t
      ? "border-primary text-primary"
      : "border-transparent text-steel hover:text-primary"
    }`;

  return (
    <RoleGuard required="dao">
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <section className="card">
        <h1 className="text-2xl font-bold text-primary">DAO 治理看板</h1>
        <p className="mt-2 section-desc">
          持有 SBT 积分的成员可发起提案、参与加权投票。提案通过后进入 2 天时间锁后执行。
        </p>
      </section>

      <div className="flex border-b border-gray-100/60 mb-6">
        <button className={tabCls("list")} onClick={() => setActiveTab("list")}>提案列表</button>
        <button className={tabCls("propose")} onClick={() => setActiveTab("propose")}>发起提案</button>
        <button className={tabCls("vote")} onClick={() => setActiveTab("vote")}>参与投票</button>
      </div>

      {activeTab === "list" && (
        <div className="space-y-3">
          <div className="flex justify-end mb-2">
            <button
              onClick={fetchProposals}
              className="text-sm text-primary underline hover:opacity-80"
            >
              刷新
            </button>
          </div>
          {loading && <p className="text-steel text-sm">加载中...</p>}
          {listMsg && <p className="text-alert text-sm">{listMsg}</p>}
          {!loading && proposals.length === 0 && !listMsg && (
            <div className="card text-center py-12 text-steel text-sm">暂无提案，去发起第一个！</div>
          )}
          {proposals.map(p => (
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
          <Button type="submit" variant="primary" size="lg" className="w-full">
            发起提案
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
          <Button type="submit" variant="primary" size="lg" className="w-full">
            提交投票
          </Button>
        </form>
      )}

    </div>
    </RoleGuard>
  );
}
