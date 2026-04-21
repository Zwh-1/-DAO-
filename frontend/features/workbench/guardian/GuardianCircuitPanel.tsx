'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getGuardianAuditLogAdmin, getGuardianStatusAdmin, postGuardianCircuit } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';
import { Button, Input } from '@/components/ui/index';

export function GuardianCircuitPanel() {
  const [status, setStatus] = useState<{ paused: boolean; bannedCount: number } | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [action, setAction] = useState<'pause' | 'resume'>('pause');
  const [reason, setReason] = useState('');
  const [circuitMsg, setCircuitMsg] = useState('');
  const [circuitOk, setCircuitOk] = useState<boolean | null>(null);
  const [auditTail, setAuditTail] = useState<string>('');

  const adminHint =
    typeof window !== 'undefined' && !localStorage.getItem('adminToken')
      ? '未检测到 adminToken：请在本地存储写入守护者 Admin Token 后再操作熔断。'
      : null;

  const loadStatus = useCallback(async () => {
    setStatusErr(null);
    try {
      const s = await getGuardianStatusAdmin();
      setStatus(s);
    } catch (e) {
      setStatus(null);
      setStatusErr(toUserErrorMessage(e));
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const r = await getGuardianAuditLogAdmin();
      const logs = Array.isArray(r.logs) ? r.logs : [];
      const tail = logs.slice(-5);
      setAuditTail(JSON.stringify(tail, null, 2));
    } catch {
      setAuditTail('');
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadAudit();
  }, [loadStatus, loadAudit]);

  async function onCircuit(e: FormEvent) {
    e.preventDefault();
    setCircuitMsg('');
    setCircuitOk(null);
    try {
      const data = await postGuardianCircuit({ action, reason });
      setCircuitOk(true);
      setCircuitMsg(data.message ?? `系统已${action === 'pause' ? '暂停' : '恢复'}`);
      await loadStatus();
      await loadAudit();
    } catch (err) {
      setCircuitOk(false);
      setCircuitMsg(toUserErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      {adminHint && <p className="rounded-lg border border-alert/30 bg-alert/5 px-4 py-3 text-sm text-alert">{adminHint}</p>}

      <section className="card">
        <h2 className="section-title mb-3">系统状态</h2>
        {statusErr && <p className="text-sm text-alert">{statusErr}</p>}
        {!statusErr && status && (
          <ul className="text-sm text-steel">
            <li>
              熔断：<span className="font-semibold text-primary">{status.paused ? '已暂停' : '正常运行'}</span>
            </li>
            <li>黑名单条目数：{status.bannedCount}</li>
          </ul>
        )}
        <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => loadStatus()}>
          刷新状态
        </Button>
      </section>

      <section className="card">
        <h2 className="section-title mb-3">紧急熔断</h2>
        <form onSubmit={onCircuit} className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" checked={action === 'pause'} onChange={() => setAction('pause')} />
              暂停
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" checked={action === 'resume'} onChange={() => setAction('resume')} />
              恢复
            </label>
          </div>
          <Input label="原因说明" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger">
            提交熔断操作
          </Button>
        </form>
        {circuitOk !== null && (
          <p className={`mt-3 text-sm ${circuitOk ? 'text-success' : 'text-alert'}`}>{circuitMsg}</p>
        )}
      </section>

      {auditTail && (
        <section className="card">
          <h2 className="section-title mb-3">最近审计片段（最多 5 条）</h2>
          <pre className="max-h-48 overflow-auto rounded-lg bg-surface/80 p-3 text-xs">{auditTail}</pre>
        </section>
      )}
    </div>
  );
}
