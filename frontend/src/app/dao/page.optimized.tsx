/**
 * DAO 治理页面（优化版）
 * 
 * 使用技术栈：
 * - React Hook Form + Zod：表单验证
 * - useQueries（useGovernanceProposals, useSubmitProposal, useVote）：数据获取与突变
 * - Toast：全局提示
 * - Skeleton：加载占位符
 * 
 * 优化点：
 * - 替换手写 fetch 为 useGovernanceProposals
 * - 替换 setInterval 为 React Query 自动轮询
 * - 表单状态使用 useForm 管理
 * - 按钮加载状态与禁用机制
 * - 结构化提案展示（替代 JSON 直接输出）
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGovernanceProposals,
  useSubmitProposal,
  useVote,
} from "@/hooks/useQueries";
import { useAuth } from "@/components/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  governanceProposalSchema,
  voteSchema,
  type GovernanceProposalFormData,
  type VoteFormData,
} from "@/lib/schemas";
import { RoleGuard } from "@/components/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * 提案状态标签映射
 */
const STATE_LABEL: Record<string, string> = {
  "0": "待定",
  "1": "投票中",
  "2": "通过",
  "3": "否决",
  "4": "排队中",
  "5": "已执行",
  "6": "已取消",
};

/**
 * 提案状态颜色映射
 */
const STATE_COLOR: Record<string, string> = {
  "0": "bg-gray-100 text-gray-700",
  "1": "bg-blue-100 text-blue-700",
  "2": "bg-green-100 text-green-700",
  "3": "bg-red-100 text-red-700",
  "4": "bg-yellow-100 text-yellow-700",
  "5": "bg-green-100 text-green-700",
  "6": "bg-gray-100 text-gray-500 line-through",
};

/**
 * 提案卡片组件（结构化展示）
 */
function ProposalCard({ proposal }: { proposal: any }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
      {/* 头部：提案 ID 与状态 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            提案 #{proposal.id}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            提案人：{proposal.proposer?.slice(0, 10)}...{proposal.proposer?.slice(-8)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATE_COLOR[proposal.state]}`}>
          {STATE_LABEL[proposal.state] || "未知"}
        </span>
      </div>
      
      {/* 提案描述 */}
      <p className="text-sm text-gray-700 mb-4 line-clamp-3">
        {proposal.description}
      </p>
      
      {/* 投票统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <div className="text-xs text-gray-500">赞成</div>
          <div className="text-sm font-semibold text-green-700">
            {proposal.forVotes || 0}
          </div>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <div className="text-xs text-gray-500">反对</div>
          <div className="text-sm font-semibold text-red-700">
            {proposal.againstVotes || 0}
          </div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500">弃权</div>
          <div className="text-sm font-semibold text-gray-700">
            {proposal.abstainVotes || 0}
          </div>
        </div>
      </div>
      
      {/* 结束时间 */}
      {proposal.endTime && (
        <div className="text-xs text-gray-500">
          投票截止：{new Date(proposal.endTime).toLocaleString("zh-CN")}
        </div>
      )}
    </div>
  );
}

export default function DAOPageOptimized() {
  const [activeTab, setActiveTab] = useState<"list" | "propose" | "vote">("list");
  const toast = useToast();
  const auth = useAuth();
  
  // 数据获取（React Query 自动轮询）
  const { proposals, stats, isLoading, isRefetching } = useGovernanceProposals({
    autoRefresh: true,
    refreshInterval: 30000, // 30 秒
  });
  
  // 提案提交（Mutation）
  const { submitProposal, isPending: isSubmitting } = useSubmitProposal({
    onSuccess: () => {
      resetProposeForm();
      setActiveTab("list"); // 成功后切换到列表
    },
  });
  
  // 投票（Mutation）
  const { vote, isPending: isVoting } = useVote({
    onSuccess: () => {
      resetVoteForm();
    },
  });
  
  // 提案表单
  const proposeForm = useForm<GovernanceProposalFormData>({
    resolver: zodResolver(governanceProposalSchema),
    defaultValues: {
      description: "",
    },
  });
  
  const { register: registerPropose, handleSubmit: handleSubmitPropose, formState: proposeFormState, reset: resetProposeForm } = proposeForm;
  const { errors: proposeErrors } = proposeFormState;
  
  // 投票表单
  const voteForm = useForm<VoteFormData>({
    resolver: zodResolver(voteSchema),
    defaultValues: {
      proposalId: "",
      support: "1",
    },
  });
  
  const { register: registerVote, handleSubmit: handleSubmitVote, formState: voteFormState, reset: resetVoteForm } = voteForm;
  const { errors: voteErrors } = voteFormState;
  
  /**
   * 提交提案处理函数
   */
  const onPropose = async (data: GovernanceProposalFormData) => {
    if (!auth.token) {
      toast.error("请先登录");
      return;
    }
    
    try {
      await submitProposal({
        description: data.description,
      });
    } catch (error) {
      // 错误已由 Hook 内部处理
    }
  };
  
  /**
   * 投票处理函数
   */
  const onVote = async (data: VoteFormData) => {
    if (!auth.token) {
      toast.error("请先登录");
      return;
    }
    
    try {
      await vote({
        proposalId: parseInt(data.proposalId),
        support: parseInt(data.support),
      });
    } catch (error) {
      // 错误已由 Hook 内部处理
    }
  };
  
  return (
    <RoleGuard required="dao">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {/* 页面标题 */}
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">DAO 治理看板</h1>
          <p className="mt-2 section-desc">
            持有 SBT 积分的成员可发起提案、参与加权投票。提案通过后进入 2 天时间锁后执行。
          </p>
        </section>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">总提案数</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="rounded-xl bg-white p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">投票中</div>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </div>
          <div className="rounded-xl bg-white p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">已通过</div>
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
          </div>
        </div>
        
        {/* 标签页切换 */}
        <section className="card">
          <div className="flex border-b border-gray-200 mb-6">
            <Button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "list"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("list")}
            >
              提案列表
            </Button>
            <Button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "propose"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("propose")}
            >
              发起提案
            </Button>
            <Button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "vote"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("vote")}
            >
              参与投票
            </Button>
          </div>
          
          {/* 提案列表 */}
          {activeTab === "list" && (
            <div>
              {isLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              )}
              
              {isRefetching && (
                <div className="mb-4 text-sm text-gray-500">
                  数据更新中...
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                {proposals.map((proposal: any) => (
                  <ProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
              
              {proposals.length === 0 && !isLoading && (
                <div className="text-center py-12 text-gray-500">
                  暂无提案
                </div>
              )}
            </div>
          )}
          
          {/* 发起提案 */}
          {activeTab === "propose" && (
            <form onSubmit={handleSubmitPropose(onPropose)} className="space-y-4 max-w-lg">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">提案描述</label>
                <textarea
                  rows={5}
                  placeholder="请详细描述提案内容..."
                  value={proposeForm.watch("description")}
                  onChange={(e) => {
                    registerPropose("description").onChange(e);
                    proposeForm.reset({ description: e.target.value });
                  }}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-50"
                />
                {proposeErrors.description && (
                  <p className="text-sm text-red-600">{proposeErrors.description.message}</p>
                )}
              </div>
              
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !!Object.keys(proposeErrors).length}
                isLoading={isSubmitting}
              >
                {isSubmitting ? "提交中..." : "提交提案"}
              </Button>
            </form>
          )}
          
          {/* 参与投票 */}
          {activeTab === "vote" && (
            <form onSubmit={handleSubmitVote(onVote)} className="space-y-4 max-w-lg">
              <Input
                label="提案 ID"
                type="text"
                placeholder="输入要投票的提案 ID"
                value={voteForm.watch("proposalId")}
                onChange={(e) => {
                  registerVote("proposalId").onChange(e);
                  voteForm.reset({ proposalId: e.target.value });
                }}
                error={voteErrors.proposalId?.message}
                disabled={isVoting}
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">投票选项</label>
                <div className="space-y-2">
                  {[
                    { value: "1", label: "赞成" },
                    { value: "0", label: "反对" },
                    { value: "2", label: "弃权" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <Input
                        type="radio"
                        value={option.value}
                        checked={voteForm.watch("support") === option.value}
                        onChange={() => {
                          registerVote("support").onChange({ target: { value: option.value } });
                          voteForm.setValue("support", option.value as "0" | "1" | "2");
                        }}
                        className="text-blue-600 focus:ring-blue-600"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
                {voteErrors.support && (
                  <p className="text-sm text-red-600">{voteErrors.support.message}</p>
                )}
              </div>
              
              <Button
                type="submit"
                variant="primary"
                disabled={isVoting || !!Object.keys(voteErrors).length}
                isLoading={isVoting}
              >
                {isVoting ? "投票中..." : "提交投票"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
