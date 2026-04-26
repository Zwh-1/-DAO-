/**
 * 请求重试与降级工具
 * 
 * 功能：
 * - 指数退避重试
 * - 请求取消
 * - 降级策略
 * - 缓存机制
 * 
 * 重试策略：
 * - 最大重试次数：3 次
 * - 初始延迟：1 秒
 * - 延迟倍增：2 倍
 * - 最大延迟：30 秒
 * 
 * 降级策略：
 * - 返回缓存数据
 * - 返回默认值
 * - 静默失败
 */

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 初始延迟（毫秒） */
  initialDelay?: number;
  /** 延迟倍增系数 */
  backoffMultiplier?: number;
  /** 最大延迟（毫秒） */
  maxDelay?: number;
  /** 可重试的错误 */
  retryableErrors?: string[];
  /** 进度回调 */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
  ],
  onRetry: () => {},
};

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断是否应该重试
 */
function shouldRetry(error: Error, config: Required<RetryConfig>): boolean {
  // 检查错误消息
  const errorMessage = error.message.toUpperCase();
  
  return config.retryableErrors.some((retryableError) =>
    errorMessage.includes(retryableError.toUpperCase())
  );
}

/**
 * 计算延迟时间（指数退避）
 */
function calculateDelay(
  attempt: number,
  config: Required<RetryConfig>
): number {
  const exponentialDelay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  
  // 添加随机抖动（避免同时重试）
  const jitter = Math.random() * 0.1 * exponentialDelay;
  
  // 限制最大延迟
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * 带重试的函数执行
 * 
 * @param fn 要执行的函数
 * @param config 重试配置
 * @returns 函数执行结果
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3, onRetry: (attempt) => console.log(`重试 ${attempt}`) }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      // 执行函数
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // 如果是最后一次尝试，不重试
      if (attempt === mergedConfig.maxRetries) {
        break;
      }
      
      // 判断是否应该重试
      if (!shouldRetry(lastError, mergedConfig)) {
        console.log('[Retry] 不满足重试条件:', lastError.message);
        break;
      }
      
      // 计算延迟
      const retryDelay = calculateDelay(attempt, mergedConfig);
      
      console.log(
        `[Retry] 第 ${attempt} 次失败，${retryDelay}ms 后重试...`,
        lastError.message
      );
      
      // 延迟后重试
      await delay(retryDelay);
      
      // 回调
      if (mergedConfig.onRetry) {
        mergedConfig.onRetry(attempt, lastError);
      }
    }
  }
  
  // 抛出最后一次错误
  throw lastError || new Error('未知错误');
}

/**
 * 降级配置
 */
export interface FallbackConfig<T> {
  /** 降级函数（返回默认值） */
  fallback?: () => Promise<T>;
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 缓存键 */
  cacheKey?: string;
  /** 缓存过期时间（毫秒） */
  cacheTTL?: number;
  /** 静默失败（不抛出错误） */
  silentFailure?: boolean;
  /** 降级回调 */
  onFallback?: (error: Error) => void;
}

/**
 * 缓存存储
 */
const cache = new Map<string, { value: any; timestamp: number }>();

/**
 * 从缓存获取
 */
function getFromCache<T>(cacheKey: string, ttl: number): T | null {
  const cached = cache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  // 检查是否过期
  const isExpired = Date.now() - cached.timestamp > ttl;
  
  if (isExpired) {
    cache.delete(cacheKey);
    return null;
  }
  
  return cached.value as T;
}

/**
 * 设置缓存
 */
function setCache<T>(cacheKey: string, value: T): void {
  cache.set(cacheKey, {
    value,
    timestamp: Date.now(),
  });
}

/**
 * 带降级的函数执行
 * 
 * @param fn 主函数
 * @param fallbackConfig 降级配置
 * @param retryConfig 重试配置
 * @returns 函数执行结果或默认值
 * 
 * @example
 * ```typescript
 * const data = await withFallback(
 *   () => fetch('/api/data'),
 *   { fallback: () => Promise.resolve(defaultData), useCache: true },
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallbackConfig: FallbackConfig<T> = {},
  retryConfig: RetryConfig = {}
): Promise<T> {
  const {
    fallback,
    useCache = false,
    cacheKey,
    cacheTTL = 5 * 60 * 1000, // 5 分钟
    silentFailure = false,
    onFallback,
  } = fallbackConfig;
  
  try {
    // 尝试从缓存获取
    if (useCache && cacheKey) {
      const cached = getFromCache<T>(cacheKey, cacheTTL);
      if (cached) {
        console.log('[Fallback] 使用缓存数据:', cacheKey);
        return cached;
      }
    }
    
    // 执行主函数（带重试）
    const result = await withRetry(fn, retryConfig);
    
    // 缓存结果
    if (useCache && cacheKey) {
      setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('[Fallback] 主函数执行失败:', error);
    
    // 降级处理
    if (fallback) {
      console.log('[Fallback] 执行降级函数');
      
      try {
        const fallbackResult = await fallback();
        
        // 缓存降级结果
        if (useCache && cacheKey) {
          setCache(cacheKey, fallbackResult);
        }
        
        return fallbackResult;
      } catch (fallbackError) {
        console.error('[Fallback] 降级函数也失败了:', fallbackError);
      }
    }
    
    // 回调
    if (onFallback && error instanceof Error) {
      onFallback(error);
    }
    
    // 静默失败
    if (silentFailure) {
      console.warn('[Fallback] 静默失败');
      return undefined as T;
    }
    
    // 抛出错误
    throw error;
  }
}

/**
 * 创建可取消的请求
 */
export function createCancellablePromise<T>(
  fn: () => Promise<T>
): { promise: Promise<T>; cancel: () => void } {
  let cancelled = false;
  
  const promise = new Promise<T>((resolve, reject) => {
    fn()
      .then((result) => {
        if (!cancelled) {
          resolve(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          reject(error);
        }
      });
  });
  
  const cancel = () => {
    cancelled = true;
  };
  
  return { promise, cancel };
}

/**
 * 清除缓存
 */
export function clearCache(cacheKey?: string): void {
  if (cacheKey) {
    cache.delete(cacheKey);
  } else {
    cache.clear();
  }
}

/**
 * 导出重试工具
 */
export const retryUtils = {
  withRetry,
  withFallback,
  createCancellablePromise,
  clearCache,
};
