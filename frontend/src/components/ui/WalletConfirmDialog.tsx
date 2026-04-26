'use client';

import React from 'react';
import { useWalletApprovalStore } from '@/store/walletApprovalStore';

const ACTION_LABEL: Record<string, string> = {
  sendTransaction: '发送交易',
  signMessage:     '签名消息',
  signTypedData:   '签名结构化数据',
};

function shorten(s: string, n = 18) {
  if (!s) return '—';
  return s.length <= n ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}

export default function WalletConfirmDialog() {
  const { pending, confirm, cancel } = useWalletApprovalStore();

  if (!pending) return null;

  const { action, payload } = pending;
  const to   = payload.to   ? String(payload.to)   : null;
  const from = payload.from ? String(payload.from)  : null;
  const data = payload.data ? String(payload.data)  : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={cancel}
      />

      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-white/70 font-medium uppercase tracking-wide">内置钱包</p>
            <h2 className="text-white font-bold text-base leading-tight">
              {ACTION_LABEL[action] ?? action}
            </h2>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-500">您的内置钱包请求确认以下操作：</p>

          <div className="rounded-xl bg-surface border border-slate-200 divide-y divide-slate-100 text-sm font-mono">
            {from && (
              <Row label="发送方" value={shorten(from)} full={from} />
            )}
            {to && (
              <Row label="合约地址" value={shorten(to)} full={to} />
            )}
            <Row label="操作类型" value={ACTION_LABEL[action] ?? action} />
            {data && (
              <Row label="调用数据" value={`${data.slice(0, 10)}…`} />
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            签名后操作将提交至区块链，无法撤销。证件等敏感信息不会离开本地设备。
          </p>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={cancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={confirm}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            确认签名
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: string; full?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-2">
      <span className="text-slate-400 text-xs font-sans shrink-0">{label}</span>
      <span
        className="text-slate-800 text-xs truncate text-right"
        title={full}
      >
        {value}
      </span>
    </div>
  );
}
