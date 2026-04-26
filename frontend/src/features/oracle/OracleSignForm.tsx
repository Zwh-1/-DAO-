'use client';

import React, { useState } from 'react';
import { Input, Button } from '@/components/ui/index';
import { oracleSignReport } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';

/**
 * 预言机追加签名表单
 * 
 * 功能：
 * - 为已有报告追加签名
 * - 达到法定签名数后自动终结
 */
export default function OracleSignForm() {
  const [reportId, setReportId] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(null);

    if (!reportId.trim()) {
      setMsg('请输入报告 ID');
      setOk(false);
      return;
    }

    try {
      const data = await oracleSignReport({ reportId });
      setOk(true);
      setMsg(`签名成功，当前签名数：${data.signatures}${data.finalized ? '（已终结 ✓）' : ''}`);
    } catch (err) {
      setOk(false);
      setMsg(toUserErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <Input
        label="报告 ID"
        placeholder="0x..."
        value={reportId}
        onChange={(e) => setReportId(e.target.value)}
      />
      {msg && (
        <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full">
        追加签名
      </Button>
    </form>
  );
}
