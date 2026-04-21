/**
 * API 客户端基础配置
 * 
 * 职责：
 * - 统一管理 API 基础 URL
 * - 处理认证 Token
 * - 处理错误响应
 * - 请求重试机制
 * 
 * 隐私保护：
 * - 不记录敏感数据到日志
 * - Token 安全存储
 */

import { buildApiUrl as buildV1Path } from "./http";

export { API_ENDPOINTS, V1, V1Mount, V1Routes } from "./v1Routes";

/**
 * API 基础配置
 */
export const API_CONFIG = {
  /** 直连后端时使用（SSR/服务端 fetch、explorer 客户端等）；与 NEXT_PUBLIC_BACKEND_URL 对齐 */
  baseURL:
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:3010',
  
  // API 版本
  version: 'v1',
  
  // 请求超时（毫秒）
  timeout: 30000,
  
  // 重试次数
  retryCount: 3,
  
  // 重试延迟（毫秒）
  retryDelay: 1000,
};

/**
 * 请求配置接口
 */
export interface RequestConfig extends RequestInit {
  /** 是否需要认证 */
  requiresAuth?: boolean;
  /** 是否重试 */
  retry?: boolean;
  /** 自定义基础 URL */
  baseURL?: string;
  /** URL 查询参数 */
  params?: Record<string, string | number | undefined>;
}

/**
 * API 错误类型
 */
export class ApiError extends Error {
  /** HTTP 状态码 */
  status: number;
  /** 错误代码 */
  code?: string;
  /** 响应数据 */
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 通用请求函数
 * 
 * @param endpoint API 端点
 * @param config 请求配置
 * @returns 响应数据
 */
export async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const {
    requiresAuth = false,
    retry = true,
    baseURL = API_CONFIG.baseURL,
    params,
    ...fetchConfig
  } = config;

  // 构建完整 URL
  const url = new URL(endpoint, baseURL);
  
  // 添加查询参数
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  // 默认配置
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // 添加认证 Token
  if (requiresAuth) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // 合并配置
  const mergedConfig: RequestInit = {
    ...fetchConfig,
    headers: {
      ...defaultHeaders,
      ...(fetchConfig.headers || {}),
    },
  };

  // 请求函数
  const doRequest = async (): Promise<T> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      const response = await fetch(url, {
        ...mergedConfig,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 处理错误响应
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          errorData
        );
      }

      // 解析响应
      const data = await response.json();
      return data as T;
    } catch (error) {
      // 处理 AbortError
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('请求超时', 408, 'TIMEOUT');
      }
      throw error;
    }
  };

  // 重试逻辑（使用指数退避）
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= (retry ? API_CONFIG.retryCount : 0); attempt++) {
    try {
      return await doRequest();
    } catch (error) {
      lastError = error as Error;
      
      // 如果是认证错误，不重试
      if (error instanceof ApiError && error.status === 401) {
        break;
      }
      
      // 最后一次尝试失败
      if (attempt === API_CONFIG.retryCount) {
        break;
      }
      
      // 延迟后重试（指数退避）
      const retryDelay = API_CONFIG.retryDelay * Math.pow(2, attempt);
      await delay(retryDelay);
    }
  }

  // 抛出最后一次错误
  throw lastError;
}

/**
 * GET 请求
 */
export function get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  return request<T>(endpoint, { ...config, method: 'GET' });
}

/**
 * POST 请求
 */
export function post<T>(
  endpoint: string,
  data?: unknown,
  config?: RequestConfig
): Promise<T> {
  return request<T>(endpoint, {
    ...config,
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PUT 请求
 */
export function put<T>(
  endpoint: string,
  data?: unknown,
  config?: RequestConfig
): Promise<T> {
  return request<T>(endpoint, {
    ...config,
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE 请求
 */
export function del<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  return request<T>(endpoint, { ...config, method: 'DELETE' });
}

/**
 * 设置认证 Token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * 清除认证 Token
 */
export function clearAuthToken(): void {
  localStorage.removeItem('auth_token');
}

/**
 * 获取认证 Token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * 构建指向后端的绝对 URL（endpoint 可为 `/v1/...` 或 `/explorer/...`）
 */
export function buildApiUrl(endpoint: string): string {
  const base = API_CONFIG.baseURL.replace(/\/$/, "");
  const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const pathOnly = ep.startsWith("/v1") ? ep.slice(3) || "/" : ep;
  const relative = buildV1Path(pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`);
  if (relative.startsWith("http")) return relative;
  return `${base}${relative}`;
}
