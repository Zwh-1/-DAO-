"use client";

import { useState } from "react";
import { RoleGuard } from "@/features/governance";
import { Input, Button, PageTransition } from "@/components/ui/index";
import { getOracleReportById, oracleSignReport, submitOracleReport } from "@/lib/api";
import { toUserErrorMessage } from "@/lib/error-map";

interface ReportStatus {
  claimId: string;
  signatures: number;
  fastTrack: boolean;
  finalized: boolean;
  approved: boolean;
}

export default function OraclePage() {
  const [activeTab, setActiveTab] = useState<"submit" | "sign" | "query">("submit");

  // Submit
  const [reportId, setReportId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [ipfsCid, setIpfsCid] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitOk, setSubmitOk] = useState<boolean | null>(null);

  // Sign
  const [signReportId, setSignReportId] = useState("");
  const [signMsg, setSignMsg] = useState("");
  const [signOk, setSignOk] = useState<boolean | null>(null);

  // Query
  const [queryId, setQueryId] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [queryMsg, setQueryMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitMsg("");
    setSubmitOk(null);

    if (!reportId.trim() || !claimId.trim() || !ipfsCid.trim()) {
      setSubmitMsg("所有字段均为必填");
      setSubmitOk(false);
      return;
    }

    try {
      const data = await submitOracleReport({ reportId, claimId, ipfsCid });
      setSubmitOk(true);
      setSubmitMsg(`报告 ${reportId} 已提交，当前签名数：${data.signatures ?? 1}`);
    } catch (err) {
      setSubmitOk(false);
      setSubmitMsg(toUserErrorMessage(err));
    }
  }

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setSignMsg("");
    setSignOk(null);

    if (!signReportId.trim()) {
      setSignMsg("请输入报告 ID");
      setSignOk(false);
      return;
    }

    try {
      const data = await oracleSignReport({ reportId: signReportId });
      setSignOk(true);
      setSignMsg(`签名成功，当前签名数：${data.signatures}${data.finalized ? "（已终结 ✓）" : ""}`);
    } catch (err) {
      setSignOk(false);
      setSignMsg(toUserErrorMessage(err));
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setQueryMsg("");
    setReportStatus(null);

    if (!queryId.trim()) {
      setQueryMsg("请输入报告 ID");
      return;
    }

    try {
      const data = (await getOracleReportById(queryId.trim())) as unknown as ReportStatus;
      setReportStatus(data);
    } catch (err) {
      setQueryMsg(toUserErrorMessage(err));
    }
  }

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t
      ? "border-primary text-primary"
      : "border-transparent text-steel hover:text-primary"
    }`;

  return (
    <RoleGuard required="oracle">
    <PageTransition>
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <section className="card">
        <h1 className="text-2xl font-bold text-primary">预言机工作台</h1>
        <p className="mt-2 section-desc">
          多签预言机提交链下证据报告；达到法定签名数后自动终结并通知申领审核。
        </p>
      </section>

      <div className="card-compact">
        <span className="font-semibold text-primary">极速通道：</span>
        <span className="text-sm text-steel">
          当单份报告获得 ≥ 5 个预言机签名时，系统绕过 DAO 等待期直接批准该申领。
          普通通道门槛为 3 个签名。
        </span>
      </div>

      <div className="flex border-b border-gray-100/60 mb-6">
        <button className={tabCls("submit")} onClick={() => setActiveTab("submit")}>提交报告</button>
        <button className={tabCls("sign")} onClick={() => setActiveTab("sign")}>追加签名</button>
        <button className={tabCls("query")} onClick={() => setActiveTab("query")}>查询状态</button>
      </div>

      {activeTab === "submit" && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <Input
            label="报告 ID（唯一标识）"
            placeholder="0x..."
            value={reportId}
            onChange={e => setReportId(e.target.value)}
          />
          <Input
            label="关联申领 ID"
            placeholder="claim-xxx"
            value={claimId}
            onChange={e => setClaimId(e.target.value)}
          />
          <Input
            label="数据 IPFS CID"
            hint="原始数据留存于链下，仅提交哈希摘要至链上"
            placeholder="ipfs://Qm..."
            value={ipfsCid}
            onChange={e => setIpfsCid(e.target.value)}
          />
          {submitMsg && (
            <p className={`text-sm ${submitOk ? "text-success" : "text-alert"}`}>{submitMsg}</p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full">
            提交报告
          </Button>
        </form>
      )}

      {activeTab === "sign" && (
        <form onSubmit={handleSign} className="card space-y-4">
          <Input
            label="报告 ID"
            placeholder="0x..."
            value={signReportId}
            onChange={e => setSignReportId(e.target.value)}
          />
          {signMsg && (
            <p className={`text-sm ${signOk ? "text-success" : "text-alert"}`}>{signMsg}</p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full">
            追加签名
          </Button>
        </form>
      )}

      {activeTab === "query" && (
        <div className="space-y-4">
          <form onSubmit={handleQuery} className="card flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="报告 ID"
                placeholder="输入报告 ID"
                value={queryId}
                onChange={e => setQueryId(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary">
              查询
            </Button>
          </form>
          {queryMsg && <p className="text-sm text-alert">{queryMsg}</p>}
          {reportStatus && (
            <div className="card space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-steel">关联申领</span>
                <span className="text-primary font-mono">{reportStatus.claimId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">签名数</span>
                <span className="font-semibold">{reportStatus.signatures}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">极速通道</span>
                <span className={reportStatus.fastTrack ? "text-success font-semibold" : "text-steel"}>
                  {reportStatus.fastTrack ? "已激活" : "未激活"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">状态</span>
                <span className={`font-semibold ${reportStatus.finalized
                    ? reportStatus.approved ? "text-success" : "text-alert"
                    : "text-primary"
                  }`}>
                  {reportStatus.finalized
                    ? reportStatus.approved ? "已批准" : "已拒绝"
                    : "投票中"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </PageTransition>
    </RoleGuard>
  );
}
