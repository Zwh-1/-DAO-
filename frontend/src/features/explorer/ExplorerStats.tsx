/**
 * 网络状态看板组件
 *
 * 数据来自 React Query：`useExplorerStats` → `GET /v1/explorer/stats`（与 `backend/src/routes/explorer.routes.js` 一致）。
 */

'use client';

import React from 'react';
import { useExplorerStats } from '@/hooks/useQueries';

interface StatCardProps {
  title: string;
  value: string | number;
  status?: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
}

function StatCard({ title, value, status = 'info', icon }: StatCardProps) {
  const statusColors = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-slate-100 text-slate-800',
  };

  return (
    <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>

      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {status && (
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${statusColors[status]}`}>
            {status === 'success' && '●'}
            {status === 'warning' && '⚠'}
            {status === 'error' && '✕'}
            {status === 'info' && '●'}
          </span>
        )}
      </div>
    </div>
  );
}

type RpcUi = 'connected' | 'degraded' | 'offline';

function mapSourceToRpc(source?: string): { display: RpcUi; label: string } {
  if (source === 'rpc') return { display: 'connected', label: '已连接' };
  if (source === 'offline') return { display: 'offline', label: '未配置 RPC' };
  return { display: 'degraded', label: '未知' };
}

export default function ExplorerStats() {
  const { stats, isLoading, error } = useExplorerStats();

  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 h-4 w-1/2 rounded bg-gray-200" />
            <div className="h-8 w-3/4 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        无法加载网络统计：{(error as Error).message}
      </div>
    );
  }

  const s = stats as {
    latestBlockNumber?: number;
    totalTransactions?: number;
    tps?: number;
    source?: string;
  } | null;

  if (!s) {
    return null;
  }

  const formatBlockNumber = (num: number) => num.toLocaleString('en-US');
  const rpc = mapSourceToRpc(s.source);
  const rpcStatus =
    rpc.display === 'connected'
      ? { text: rpc.label, status: 'success' as const }
      : rpc.display === 'offline'
        ? { text: rpc.label, status: 'error' as const }
        : { text: rpc.label, status: 'warning' as const };

  const pendingGuess = Math.floor((s.tps ?? 0) * 10);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="最新区块高度"
        value={formatBlockNumber(s.latestBlockNumber ?? 0)}
        status="success"
        icon={<span className="text-xl">📦</span>}
      />

      <StatCard
        title="RPC / 数据源"
        value={rpcStatus.text}
        status={rpcStatus.status}
        icon={<span className="text-xl">🔌</span>}
      />

      <StatCard
        title="近期抽样交易数"
        value={(s.totalTransactions ?? 0).toLocaleString()}
        status="info"
        icon={<span className="text-xl">📊</span>}
      />

      <StatCard
        title="待估算队列（TPS 推导）"
        value={pendingGuess.toLocaleString()}
        status={pendingGuess === 0 ? 'success' : 'warning'}
        icon={<span className="text-xl">⏳</span>}
      />
    </div>
  );
}
