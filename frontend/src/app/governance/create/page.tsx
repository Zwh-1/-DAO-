"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";
import { useAuthStore } from "@/store/authStore";
import { toUserErrorMessage } from "@/lib/error-map";
import { useSubmitProposal } from "@/hooks/useQueries";

const PROPOSAL_TYPES = [
  { value: "parameter", label: "参数变更", desc: "修改合约系统参数，需 Timelock 执行" },
  { value: "upgrade", label: "合约升级", desc: "提交代理合约的实现升级提案" },
  { value: "blacklist", label: "黑名单操作", desc: "针对恶意地址的封禁或解禁" },
  { value: "general", label: "一般提案", desc: "其他社区治理事项" },
];

export default function GovernanceCreatePage() {
  const router = useRouter();
  const jwt = useAuthStore((s) => s.token);
  const [proposalType, setProposalType] = useState("general");
  const [description, setDescription] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [calldata, setCalldata] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);

  const { submitProposal, isPending } = useSubmitProposal({
    onSuccess: (data) => {
      setOk(true);
      setMsg(`提案 #${data.proposalId ?? "?"} 已发起，进入投票期！`);
      setTimeout(() => router.push("/governance/proposals"), 2000);
    },
    onError: (err) => {
      setOk(false);
      setMsg(toUserErrorMessage(err));
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setOk(null);
    if (!description.trim()) {
      setOk(false);
      setMsg("提案描述不能为空");
      return;
    }
    if (!jwt) {
      setOk(false);
      setMsg("请先登录（SIWE）");
      return;
    }
    await submitProposal({ description: description.trim() });
  }

  return (
    <RoleGuard required="dao">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="card">
            <div className="flex items-center gap-3 mb-1">
              <Link href="/governance/proposals" className="text-steel hover:text-primary text-sm">
                ← 提案大厅
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-primary">发起提案</h1>
            <p className="mt-1 section-desc">
              提案发起后进入 3 天投票期，通过后经 Timelock 延迟执行。
            </p>
          </section>

          <form onSubmit={handleSubmit} className="card space-y-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">提案类型</label>
              <div className="grid grid-cols-2 gap-3">
                {PROPOSAL_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setProposalType(t.value)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      proposalType === t.value
                        ? "border-primary bg-primary/5"
                        : "border-gray-100/60 hover:border-primary/40"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${proposalType === t.value ? "text-primary" : "text-primary/80"}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-steel mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">提案描述 *</label>
              <textarea
                className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={5}
                placeholder="请清晰描述本提案的目标、预期效果及执行方式..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {(proposalType === "parameter" || proposalType === "upgrade") && (
              <>
                <Input
                  label="目标合约地址（可选）"
                  placeholder="0x..."
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">调用数据 calldata（可选）</label>
                  <textarea
                    className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm font-mono text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    placeholder="0x..."
                    value={calldata}
                    onChange={(e) => setCalldata(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-3 text-xs text-steel">
              发起提案需持有 SBT 积分（由后端校验）。投票期为 <strong className="text-primary">3 天</strong>，通过阈值为 51%。
            </div>

            {msg && (
              <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={isPending}>
                {isPending ? "提交中…" : "发起提案"}
              </Button>
              <Link
                href="/governance"
                className="flex items-center justify-center rounded-xl border border-gray-200 px-6 text-sm font-medium text-steel hover:text-primary transition-colors"
              >
                取消
              </Link>
            </div>
          </form>
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
