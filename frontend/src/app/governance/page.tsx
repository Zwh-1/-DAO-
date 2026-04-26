'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/auth';
import { PageTransition } from '@/components/ui/index';
import { useAuthStore } from '@/store/authStore';
import { useGovernanceProposals } from '@/hooks/useQueries';
import GovernancePageHeader from '@/features/governance/GovernancePageHeader';
import ProposalList from '@/features/governance/ProposalList';
import ProposalForm from '@/features/governance/ProposalForm';
import VoteForm from '@/features/governance/VoteForm';

/**
 * DAO 治理中心页面
 * 
 * 功能：
 * - 提案列表展示
 * - 发起新提案
 * - 参与投票
 */
export default function GovernancePage() {
  const jwt = useAuthStore((s) => s.token);
  const [activeTab, setActiveTab] = useState<'list' | 'propose' | 'vote'>('list');

  const {
    proposals,
    stats,
    isLoading: listLoading,
    isRefetching,
    error: listError,
    refetch,
  } = useGovernanceProposals({ autoRefresh: true, refreshInterval: 30_000 });

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-primary text-primary'
        : 'border-transparent text-steel hover:text-primary'
    }`;

  return (
    <RoleGuard required="dao">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* 页面头部 */}
          <GovernancePageHeader stats={stats} />

          {/* 标签页导航 */}
          <div className="flex border-b border-gray-100/60 mb-6">
            <button className={tabCls('list')} onClick={() => setActiveTab('list')}>提案列表</button>
            <button className={tabCls('propose')} onClick={() => setActiveTab('propose')}>发起提案</button>
            <button className={tabCls('vote')} onClick={() => setActiveTab('vote')}>参与投票</button>
          </div>

          {/* 标签页内容 */}
          {activeTab === 'list' && (
            <ProposalList
              proposals={proposals}
              stats={stats}
              isLoading={listLoading}
              isRefetching={isRefetching}
              error={listError}
              onRefresh={() => refetch()}
            />
          )}
          {activeTab === 'propose' && <ProposalForm jwt={jwt} />}
          {activeTab === 'vote' && <VoteForm jwt={jwt} />}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
