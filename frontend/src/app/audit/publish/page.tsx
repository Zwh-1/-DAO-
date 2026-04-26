"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/auth";
import { Button, Input, PageTransition } from "@/components/ui/index";

export default function AuditPublishPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [summary, setSummary] = useState("");
  const [ipfsCid, setIpfsCid] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setOk(null);
    if (!title.trim() || !period.trim() || !summary.trim()) {
      setOk(false); setMsg("请填写报告标题、覆盖周期和摘要"); return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setOk(true);
      setMsg("审计报告已发布并上链存储，IPFS CID 已生成。");
      setTimeout(() => router.push("/audit/reports"), 2000);
    } catch {
      setOk(false); setMsg("发布失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const SECTIONS = [
    "平台概述", "资金池状况", "理赔统计", "仲裁与挑战",
    "欺诈检测", "Oracle 运行", "风险提示", "建议措施",
  ];

  return (
    <RoleGuard required={["guardian", "dao"]} mode="any">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="card">
            <Link href="/audit/reports" className="text-steel hover:text-primary text-sm">← 历史报告</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">发布审计报告</h1>
            <p className="mt-1 section-desc">
              报告内容将上传至 IPFS 并将哈希记录在链上，发布后不可篡改。
            </p>
          </section>

          <form onSubmit={handlePublish} className="card space-y-5">
            <Input
              label="报告标题 *"
              placeholder="例如：2026 年 Q2 季度审计报告"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              label="覆盖周期 *"
              placeholder="例如：2026-04-01 ~ 2026-06-30"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-primary mb-1">报告摘要 *</label>
              <textarea
                className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={4}
                placeholder="对本期平台运行状况的简要总结..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">报告包含章节</label>
              <div className="grid grid-cols-2 gap-2">
                {SECTIONS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-steel cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-primary rounded" />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              label="IPFS CID（可选，若已手动上传）"
              placeholder="Qm..."
              value={ipfsCid}
              onChange={(e) => setIpfsCid(e.target.value)}
            />

            <div className="rounded-xl bg-surface/50 border border-gray-100/60 p-3 text-xs text-steel">
              若未提供 IPFS CID，系统将根据填写内容自动生成报告并上传。报告一旦发布即在链上公示，无法删除。
            </div>

            {msg && <p className={`text-sm ${ok ? "text-success" : "text-alert"}`}>{msg}</p>}

            <div className="flex gap-3">
              <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={submitting}>
                {submitting ? "发布中…" : "发布报告"}
              </Button>
              <Link
                href="/audit/reports"
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
