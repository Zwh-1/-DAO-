/**
 * 数据获取 Hook（带重试和降级）
 * 
 * 功能：
 * - 自动重试
 * - 降级策略
 * - 缓存管理
 * - 加载状态
 * 
 * 使用示例：
 * ```typescript
 * const { data, isLoading, error } = useFetchWithFallback(
 *   '/api/data',
 *   { fallback: () => Promise.resolve(defaultData) }
 * );
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { withFallback, withRetry, clearCache } from '../lib/utils/retry';
import { get } from '../lib/api/client';

/**
 * 获取配置
 */
export interface FetchConfig<T> {
  /** 是否立即执行 */
  immediate?: boolean;
  /** 降级配置 */
  fallback?: () => Promise<T>;
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 缓存键 */
  cacheKey?: string;
  /** 重试配置 */
  retryCount?: number;
}

/**
 * 获取结果
 */
export interface FetchResult<T> {
  /** 数据 */
  data: T | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否成功 */
  isSuccess: boolean;
  /** 重新获取 */
  refetch: () => Promise<void>;
  /** 清除缓存 */
  clearCache: () => void;
}

/**
 * 数据获取 Hook（带重试和降级）
 */
export function useFetchWithFallback<T>(
  endpoint: string,
  config: FetchConfig<T> = {}
): FetchResult<T> {
  const {
    immediate = true,
    fallback,
    useCache = true,
    cacheKey,
    retryCount = 3,
  } = config;

  // 状态
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * 执行获取
   */
  const execute = useCallback(async () => {
    console.log('[useFetch] 开始获取数据:', endpoint);
    
    setIsLoading(true);
    setError(null);

    try {
      // 使用重试和降级机制
      const result = await withFallback<T>(
        async () => {
          // 主函数：API 请求
          return await get<T>(endpoint, {
            retry: true,
          });
        },
        {
          // 降级配置
          fallback,
          useCache,
          cacheKey: cacheKey || endpoint,
          silentFailure: false,
          onFallback: (error) => {
            console.warn('[useFetch] 触发降级:', error.message);
          },
        },
        {
          // 重试配置
          maxRetries: retryCount,
          onRetry: (attempt, error) => {
            console.log(`[useFetch] 第 ${attempt} 次重试...`, error.message);
          },
        }
      );

      setData(result);
      setIsSuccess(true);
      console.log('[useFetch] 数据获取成功');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取失败';
      console.error('[useFetch] 获取失败:', errorMessage);
      
      setError(errorMessage);
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, fallback, useCache, cacheKey, retryCount]);

  /**
   * 重新获取
   */
  const refetch = useCallback(async () => {
    // 清除缓存
    if (cacheKey) {
      clearCache(cacheKey);
    }
    
    // 重新执行
    await execute();
  }, [execute, cacheKey]);

  /**
   * 清除缓存
   */
  const clearCacheCallback = useCallback(() => {
    clearCache(cacheKey || endpoint);
  }, [cacheKey, endpoint]);

  /**
   * 自动执行
   */
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    data,
    isLoading,
    error,
    isSuccess,
    refetch,
    clearCache: clearCacheCallback,
  };
}

/**
 * 导出默认 Hook
 */
export default useFetchWithFallback;
