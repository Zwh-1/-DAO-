'use client';

import React, { useState } from 'react';
import { Input, Button } from '@/components/ui/index';
import { postGuardianBlacklist, ApiError } from '@/lib/api';

/**
 * 守护者黑名单管理面板
 * 
 * 功能：
 * - 地址黑名单添加
 * - 拉黑原因记录（审计日志）
 */
export default function GuardianBlacklistPanel() {
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(null);

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setMsg('请输入合法的以太坊地址');
      setOk(false);
      return;
    }

    try {
      await postGuardianBlacklist({ address, reason });
      setOk(true);
      setMsg(`地址 ${address.slice(0, 8)}... 已加入黑名单`);
      setAddress('');
      setReason('');
    } catch (err) {
      setOk(false);
      setMsg(err instanceof ApiError ? err.message : '网络错误');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <Input label="目标钱包地址" placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)} />
      <Input
        label="拉黑原因（必填）"
        placeholder="例如：女巫攻击检测"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {msg && <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>}
      <Button type="submit" variant="danger" size="lg" className="w-full">
        加入黑名单
      </Button>
    </form>
  );
}
