/**
 * 数据获取 Custom Hooks（基于 React Query）
 * 
 * 职责：
 * - 替换手写数据轮询（setInterval）与普通 fetch
 * - 实现自动化轮询、窗口焦点重新获取、智能缓存
 * - 处理请求竞态条件与错误重试
 * 
 * 性能优势：
 * - 自动缓存：避免重复请求
 * - 后台更新：用户无感知刷新
 * - 请求去重：相同查询只发送一次
 * 
 * 隐私保护：
 * - 不记录敏感数据到日志
 * - 错误消息脱敏处理
 */

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { toastManager } from "../components/ui/Toast";
import {
  fetchHealth,
  fetchGovernanceProposals,
  fetchMemberProfilePublic,
  fetchExplorerStats,
  submitGovernanceProposal,
  submitGovernanceVote,
  fetchMemberActivity,
  fetchMemberReputation,
  type ActivityResponse,
  type ReputationResponse,
} from "@/lib/api";

/**
 * 查询键（Query Keys）工厂
 * 
 * 使用工厂函数统一管理所有查询键
 * 避免硬编码字符串，便于维护与重构
 */
export const queryKeys = {
  // 健康检查
  health: {
    all: ["health"] as const,
    detail: () => [...queryKeys.health.all, "detail"] as const,
  },
  
  // 治理提案
  governance: {
    all: ["governance"] as const,
    proposals: () => [...queryKeys.governance.all, "proposals"] as const,
    proposal: (id: number) => [...queryKeys.governance.proposals(), id] as const,
  },
  
  // 成员画像
  member: {
    all: ["member"] as const,
    profile: (address: string) => [...queryKeys.member.all, "profile", address] as const,
    activity: (address: string, page: number) => [...queryKeys.member.all, "activity", address, page] as const,
    reputation: (address: string) => [...queryKeys.member.all, "reputation", address] as const,
  },
  
  // 匿名申领
  anonymousClaim: {
    all: ["anonymousClaim"] as const,
    list: () => [...queryKeys.anonymousClaim.all, "list"] as const,
  },
  
  // 区块浏览器
  explorer: {
    all: ["explorer"] as const,
    blocks: () => [...queryKeys.explorer.all, "blocks"] as const,
    transactions: () => [...queryKeys.explorer.all, "transactions"] as const,
    stats: () => [...queryKeys.explorer.all, "stats"] as const,
  },
};

/**
 * Hook：健康检查
 * 
 * 替换首页的 setInterval 轮询
 * 自动每 30 秒刷新一次，窗口聚焦时重新获取
 * 
 * 使用方式：
 * ```tsx
 * const { health, backendOk, isLoading, error } = useHealthCheck();
 * ```
 */
export function useHealthCheck(refreshInterval: number = 30000) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.health.detail(),
    queryFn: async () => fetchHealth(),
    // 刷新间隔
    refetchInterval: refreshInterval,
    // 窗口聚焦时重新获取
    refetchOnWindowFocus: true,
    // 网络恢复时重新获取
    refetchOnReconnect: true,
    // 数据在 15 秒内视为新鲜，减少不必要的重复请求
    staleTime: 15_000,
    // 重试次数
    retry: 3,
    // 重试延迟（毫秒）
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: true,
  });
  
  // 派生状态
  const backendOk = !error && !!data;
  const health = data || null;
  
  return { health, backendOk, isLoading, error };
}

/**
 * Hook：治理提案列表
 * 
 * 替换 DAO 页面的手写 fetch
 * 支持自动轮询、缓存共享、错误重试
 * 
 * 使用方式：
 * ```tsx
 * const { proposals, stats, isLoading, refetch } = useGovernanceProposals();
 * ```
 */
export function useGovernanceProposals(options?: {
  /** 是否启用自动轮询 */
  autoRefresh?: boolean;
  /** 轮询间隔（毫秒） */
  refreshInterval?: number;
}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options || {};
  
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.governance.proposals(),
    queryFn: async () => fetchGovernanceProposals(),
    // 自动轮询配置
    refetchInterval: autoRefresh ? refreshInterval : false,
    // 后台标签页也持续轮询（保持数据新鲜）
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // 数据在 10 秒内视为新鲜
    staleTime: 10_000,
    // 重试配置
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: true,
  });
  
  // 派生数据
  const proposals = data?.proposals || [];
  const stats = {
    total: proposals.length,
    active: proposals.filter((p: any) => p.state === "1").length,
    passed: proposals.filter((p: any) => p.state === "2").length,
  };
  
  return {
    proposals,
    stats,
    isLoading,
    isRefetching,
    error,
    refetch,
  };
}

/**
 * Hook：成员画像查询
 * 
 * 支持按需获取、缓存复用
 * 
 * 使用方式：
 * ```tsx
 * const { profile, isLoading, refetch } = useMemberProfile(address);
 * ```
 */
export function useMemberProfile(address: string | null, options?: {
  /** 是否立即获取 */
  enabled?: boolean;
}) {
  const { enabled = !!address } = options || {};
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: address ? queryKeys.member.profile(address) : ["member", "profile", "disabled"],
    queryFn: async () => {
      if (!address) {
        throw new Error("地址为空");
      }
      return fetchMemberProfilePublic(address);
    },
    // 仅在 enabled 为 true 时获取
    enabled,
    // 重试配置
    retry: 2,
  });
  
  return {
    profile: data || null,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook：提案提交（Mutation）
 * 
 * 替换 DAO 页面的手写 POST 请求
 * 支持加载状态、错误处理、自动刷新
 * 
 * 使用方式：
 * ```tsx
 * const { submitProposal, isPending, error } = useSubmitProposal();
 * await submitProposal({ description }); // JWT 来自 trustaid-auth，无需传 token
 * ```
 */
export function useSubmitProposal(options?: {
  /** 成功后回调 */
  onSuccess?: (data: any) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  
  const { mutateAsync: submitProposal, isPending, error } = useMutation({
    mutationFn: async ({ description }: { description: string }) => {
      return submitGovernanceProposal({ description });
    },
    // 成功后刷新提案列表
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.governance.proposals() });
      toastManager.success(`提案 #${data.proposalId} 已创建！`);
      options?.onSuccess?.(data);
    },
    // 错误处理
    onError: (err) => {
      toastManager.error(`提案失败：${(err as Error).message}`);
      options?.onError?.(err as Error);
    },
  });
  
  return {
    submitProposal,
    isPending,
    error,
  };
}

/**
 * Hook：投票（Mutation）
 * 
 * 替换 DAO 页面的手写 POST 投票请求
 */
export function useVote(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  
  const { mutateAsync: vote, isPending, error } = useMutation({
    mutationFn: async ({
      proposalId,
      support,
    }: {
      proposalId: number;
      support: number;
    }) => {
      return submitGovernanceVote({ proposalId, support });
    },
    // 乐观更新：在服务器确认前立即反映投票结果
    onMutate: async ({ proposalId, support }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.governance.proposals() });
      const previous = queryClient.getQueryData(queryKeys.governance.proposals());
      queryClient.setQueryData(queryKeys.governance.proposals(), (old: any) => {
        if (!old?.proposals) return old;
        return {
          ...old,
          proposals: old.proposals.map((p: any) => {
            if (p.id !== proposalId) return p;
            const forDelta = support === 1 ? "1" : "0";
            const againstDelta = support === 0 ? "1" : "0";
            const abstainDelta = support === 2 ? "1" : "0";
            return {
              ...p,
              forVotes: String(BigInt(p.forVotes || "0") + BigInt(forDelta)),
              againstVotes: String(BigInt(p.againstVotes || "0") + BigInt(againstDelta)),
              abstainVotes: String(BigInt(p.abstainVotes || "0") + BigInt(abstainDelta)),
            };
          }),
        };
      });
      return { previous };
    },
    // 成功后刷新提案列表
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.governance.proposals() });
      toastManager.success("投票成功！");
      options?.onSuccess?.(data);
    },
    // 错误回滚乐观更新
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.governance.proposals(), context.previous);
      }
      toastManager.error(`投票失败：${(err as Error).message}`);
      options?.onError?.(err as Error);
    },
  });
  
  return {
    vote,
    isPending,
    error,
  };
}

/**
 * Hook：区块浏览器统计数据
 * 
 * 替换 Explorer 页面的手写 fetch
 */
export function useExplorerStats(refreshInterval: number = 60000) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.explorer.stats(),
    queryFn: async () => fetchExplorerStats(),
    // 刷新间隔（1 分钟）
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: true,
    // 重试配置
    retry: 3,
  });
  
  return {
    stats: data || null,
    isLoading,
    error,
  };
}

/**
 * Hook：成员画像查询（带缓存优化）
 * 
 * 使用方式：
 * ```tsx
 * const { profile, isLoading } = useMemberProfileCached(address);
 * ```
 */
/**
 * Hook：成员活动记录
 */
export function useMemberActivity(address: string | null, page = 1) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.member.activity(address ?? "", page),
    queryFn: () => fetchMemberActivity(address!, page),
    enabled: !!address,
    staleTime: 30_000,
    retry: 2,
  });

  return {
    activities: data?.activities ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook：成员声誉评分与趋势
 */
export function useMemberReputation(address: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.member.reputation(address ?? ""),
    queryFn: () => fetchMemberReputation(address!),
    enabled: !!address,
    staleTime: 60_000,
    retry: 2,
  });

  return {
    score: data?.score ?? null,
    breakdown: data?.breakdown ?? null,
    trend: data?.trend ?? [],
    isLoading,
    error,
    refetch,
  };
}

export function useMemberProfileCached(address: string | null) {
  const queryClient = useQueryClient();
  
  // 预检查缓存
  const cachedData = address
    ? queryClient.getQueryData(queryKeys.member.profile(address))
    : null;
  
  // 使用普通 Hook，但优先返回缓存
  const { profile, isLoading, error, refetch } = useMemberProfile(address, {
    enabled: !!address,
  });
  
  return {
    profile: cachedData || profile,
    isLoading: !cachedData && isLoading,
    isCached: !!cachedData,
    error,
    refetch,
  };
}
