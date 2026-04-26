'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { postGuardianCircuit, ApiError } from '@/lib/api';

/**
 * 守护者熔断器控制面板
 * 
 * 功能：
 * - 紧急暂停系统
 * - 恢复系统运行
 * - 操作原因记录（审计日志）
 */
export default function GuardianCircuitPanel() {
  const [action, setAction] = useState<'pause' | 'resume'>('pause');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(null);
    try {
      const data = await postGuardianCircuit({ action, reason });
      setOk(true);
      setMsg(`系统已${action === 'pause' ? '暂停' : '恢复'}：${(data as { message?: string }).message ?? ''}`);
    } catch (err) {
      setOk(false);
      setMsg(err instanceof ApiError ? err.message : '网络错误');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="block text-sm font-medium text-primary mb-2">操作类型</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="action"
              value="pause"
              checked={action === 'pause'}
              onChange={() => setAction('pause')}
              className="accent-alert"
            />
            <span className="text-sm text-alert font-medium">紧急暂停</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="action"
              value="resume"
              checked={action === 'resume'}
              onChange={() => setAction('resume')}
              className="accent-success"
            />
            <span className="text-sm text-success font-medium">恢复运行</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">操作原因</label>
        <textarea
          className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          rows={3}
          placeholder="请说明紧急暂停或恢复运行的原因（将写入审计日志）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {msg && <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>}
      <Button type="submit" variant={action === 'pause' ? 'danger' : 'success'} size="lg" className="w-full">
        {action === 'pause' ? '执行紧急暂停' : '恢复系统运行'}
      </Button>
    </form>
  );
}
