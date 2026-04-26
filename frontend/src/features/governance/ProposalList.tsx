'use client';

import React from 'react';
import { toUserErrorMessage } from '@/lib/error-map';

const STATE_LABEL: Record<string, string> = {
  '0': '待定',
  '1': '投票中',
  '2': '通过',
  '3': '否决',
  '4': '排队中',
  '5': '已执行',
  '6': '已取消',
};

const STATE_COLOR: Record<string, string> = {
  '0': 'text-steel',
  '1': 'text-primary font-semibold',
  '2': 'text-success font-semibold',
  '3': 'text-alert font-semibold',
  '4': 'text-primary',
  '5': 'text-success',
  '6': 'text-steel line-through',
};

interface ProposalListProps {
  proposals: Array<{
    id: number;
    description: string;
    state: string;
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
  }>;
  stats: { total: number; active: number; passed: number };
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  onRefresh: () => void;
}

/**
 * 治理提案列表
 * 
 * 展示：
 * - 提案卡片（ID、描述、状态、投票统计）
 * - 加载状态与错误提示
 * - 刷新按钮
 */
export default function ProposalList({
  proposals,
  stats,
  isLoading,
  isRefetching,
  error,
  onRefresh,
}: ProposalListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 mb-2">
        {isRefetching && <span className="text-xs text-steel animate-pulse">刷新中…</span>}
        <button
          onClick={onRefresh}
          className="text-sm text-primary underline hover:opacity-80"
        >
          刷新
        </button>
      </div>
      {isLoading && <p className="text-steel text-sm">加载中...</p>}
      {error && <p className="text-alert text-sm">{toUserErrorMessage(error)}</p>}
      {!isLoading && proposals.length === 0 && !error && (
        <div className="card text-center py-12 text-steel text-sm">暂无提案，去发起第一个！</div>
      )}
      {proposals.map((p) => (
        <div key={p.id} className="card-compact">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-xs text-steel mr-2">#{p.id}</span>
              <span className="text-sm font-semibold text-primary">{p.description}</span>
            </div>
            <span className={`text-xs ${STATE_COLOR[p.state] ?? 'text-steel'}`}>
              {STATE_LABEL[p.state] ?? p.state}
            </span>
          </div>
          <div className="flex gap-6 text-xs text-steel mt-2">
            <span className="text-success">赞成 {p.forVotes}</span>
            <span className="text-alert">反对 {p.againstVotes}</span>
            <span>弃权 {p.abstainVotes}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
