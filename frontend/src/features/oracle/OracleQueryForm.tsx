'use client';

import React, { useState } from 'react';
import { Input, Button } from '@/components/ui/index';
import { getOracleReportById } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';

interface ReportStatus {
  claimId: string;
  signatures: number;
  fastTrack: boolean;
  finalized: boolean;
  approved: boolean;
}

/**
 * 预言机报告状态查询
 * 
 * 功能：
 * - 查询报告状态
 * - 展示签名数、极速通道状态、审批状态
 */
export default function OracleQueryForm() {
  const [queryId, setQueryId] = useState('');
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [msg, setMsg] = useState('');

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setReportStatus(null);

    if (!queryId.trim()) {
      setMsg('请输入报告 ID');
      return;
    }

    try {
      const data = (await getOracleReportById(queryId.trim())) as unknown as ReportStatus;
      setReportStatus(data);
    } catch (err) {
      setMsg(toUserErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleQuery} className="card flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label="报告 ID"
            placeholder="输入报告 ID"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary">
          查询
        </Button>
      </form>
      {msg && <p className="text-sm text-alert">{msg}</p>}
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
            <span className={reportStatus.fastTrack ? 'text-success font-semibold' : 'text-steel'}>
              {reportStatus.fastTrack ? '已激活' : '未激活'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-steel">状态</span>
            <span
              className={`font-semibold ${
                reportStatus.finalized
                  ? reportStatus.approved
                    ? 'text-success'
                    : 'text-alert'
                  : 'text-primary'
              }`}
            >
              {reportStatus.finalized ? (reportStatus.approved ? '已批准' : '已拒绝') : '投票中'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
