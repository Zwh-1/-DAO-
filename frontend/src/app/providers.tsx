/**
 * React Query 全局提供者优化版
 * * 优化点：
 * 1. 强类型 meta 接口：支持自定义错误文案及开关
 * 2. 智能重试：区分错误类型，避免无效重试
 * 3. 统一错误拦截：联动 Toast 系统
 */

"use client";

import { 
  QueryClient, 
  QueryClientProvider, 
  QueryCache, 
  MutationCache 
} from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from "react";
import { toastManager } from "@/components/ui/Toast";

/**
 * 扩展 TanStack Query 的 Meta 类型定义
 * 这样在调用 useQuery 时，IDE 会自动提示 meta 下的属性
 */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      errorMessage?: string | false;
      showToast?: boolean;
    };
    mutationMeta: {
      errorMessage?: string | false;
      showToast?: boolean;
    };
  }
}

/**
 * 统一错误处理逻辑
 */
const handleGlobalError = (error: any, meta?: Record<string, any>) => {
  // 1. 如果显式设置 errorMessage 为 false，则跳过全局提示
  if (meta?.errorMessage === false || meta?.showToast === false) return;

  // 2. 获取错误消息（优先使用 meta 定义的文案）
  const message = meta?.errorMessage || error?.message || "请求执行出错";
  
  // 3. 触发 Toast
  toastManager.error(message);

  // 4. (可选) 处理特定业务逻辑，如 401 未授权跳转
  if (error?.status === 401) {
    // window.location.href = '/login';
  }
};

function makeQueryClient() {
  return new QueryClient({
    // 查询缓存全局回调
    queryCache: new QueryCache({
      onError: (error, query) => handleGlobalError(error, query.meta),
    }),
    
    // 突变缓存全局回调
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => 
        handleGlobalError(error, mutation.meta),
    }),

    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        // 智能重试逻辑
        retry: (failureCount, error: any) => {
          // 如果是 404 或 401/403 等客户端错误，不进行重试
          if (error?.status >= 400 && error?.status < 500) return false;
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        refetchOnWindowFocus: false, // 默认关闭，减少不必要的背景刷新
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0, // 突变通常涉及写操作，默认不重试以防幂等性问题
      },
    },
  });
}

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  // 单例模式，防止 HMR (热更新) 时 client 重置
  const [queryClient] = useState(() => makeQueryClient());
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      
      {/* 仅在开发环境开启 Devtools，且根据环境变量判断 */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          buttonPosition="bottom-left" 
        />
      )}
    </QueryClientProvider>
  );
}

export default ReactQueryProvider;