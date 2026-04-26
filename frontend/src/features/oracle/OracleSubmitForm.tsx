'use client';

import React, { useState } from 'react';
import { Input, Button } from '@/components/ui/index';
import { submitOracleReport } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';

/**
 * 预言机报告提交表单
 * 
 * 功能：
 * - 提交新报告（报告 ID、申领 ID、IPFS CID）
 * - 原始数据留存于链下，仅提交哈希摘要至链上
 */
export default function OracleSubmitForm() {
  const [reportId, setReportId] = useState('');
  const [claimId, setClaimId] = useState('');
  const [ipfsCid, setIpfsCid] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(null);

    if (!reportId.trim() || !claimId.trim() || !ipfsCid.trim()) {
      setMsg('所有字段均为必填');
      setOk(false);
      return;
    }

    try {
      const data = await submitOracleReport({ reportId, claimId, ipfsCid });
      setOk(true);
      setMsg(`报告 ${reportId} 已提交，当前签名数：${data.signatures ?? 1}`);
    } catch (err) {
      setOk(false);
      setMsg(toUserErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <Input
        label="报告 ID（唯一标识）"
        placeholder="0x..."
        value={reportId}
        onChange={(e) => setReportId(e.target.value)}
      />
      <Input
        label="关联申领 ID"
        placeholder="claim-xxx"
        value={claimId}
        onChange={(e) => setClaimId(e.target.value)}
      />
      <Input
        label="数据 IPFS CID"
        hint="原始数据留存于链下，仅提交哈希摘要至链上"
        placeholder="ipfs://Qm..."
        value={ipfsCid}
        onChange={(e) => setIpfsCid(e.target.value)}
      />
      {msg && (
        <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full">
        提交报告
      </Button>
    </form>
  );
}
