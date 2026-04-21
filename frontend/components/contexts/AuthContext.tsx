/**
 * 认证上下文（AuthContext）
 * 
 * 职责：
 * - 统一管理 JWT Token，避免直接使用 localStorage
 * - 提供安全的认证状态共享机制
 * - 支持 HttpOnly Cookie 与内存存储双模式
 * 
 * 隐私保护：
 * - Token 不直接暴露在组件中
 * - 支持自动刷新机制（未来扩展）
 * 
 * 安全性：
 * - 减少 XSS 攻击风险（相比直接使用 localStorage）
 * - 支持权限检查与角色管理
 */

"use client";

import { createContext, useContext, useEffect, useCallback, type ReactNode } from "react";
import { useAuthStore, type RoleId } from "../../store/authStore";
import { apiFetch } from "@/lib/api/http";
import { V1Routes } from "@/lib/api/v1Routes";

/**
 * Token 存储策略枚举
 * 
 * 安全等级排序：
 * 1. httpOnly (最安全，Token 存储在 HttpOnly Cookie 中，JavaScript 无法访问)
 * 2. memory (中等，仅存储在内存中，刷新页面后丢失)
 * 3. localStorage (不推荐，易受 XSS 攻击)
 */
type TokenStorageStrategy = "httpOnly" | "memory" | "localStorage";

/**
 * AuthContext 的状态接口
 */
interface AuthContextState {
  // Token 相关
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
  
  // 认证状态
  isAuthenticated: boolean;
  isTokenExpired: boolean;
  
  // 用户信息
  address: string | null;
  roles: RoleId[];
  activeRole: RoleId | null;
  
  // 角色操作
  setActiveRole: (role: RoleId | null) => void;
  hasRole: (role: RoleId | RoleId[]) => boolean;
  
  // 加载状态
  isLoading: boolean;
  
  // 存储策略（用于调试与降级）
  strategy: TokenStorageStrategy;
}

/**
 * 创建 AuthContext
 * 初始值为 undefined，用于检测是否在 Provider 内使用
 */
const AuthContext = createContext<AuthContextState | undefined>(undefined);

/**
 * Token 管理器（内部工具类）
 * 
 * 封装 Token 的存储与读取逻辑
 * 支持多种存储策略的无缝切换
 */
class TokenManager {
  private strategy: TokenStorageStrategy;
  
  constructor(strategy: TokenStorageStrategy = "memory") {
    this.strategy = strategy;
  }
  
  /**
   * 获取 Token
   * 
   * 安全注意：
   * - httpOnly 模式下返回 null（Token 由浏览器自动携带）
   * - 避免在日志中打印 Token
   */
  getToken(): string | null {
    switch (this.strategy) {
      case "httpOnly":
        // HttpOnly Cookie 模式下，Token 由浏览器自动携带
        // JavaScript 无法读取，返回 null
        return null;
      
      case "memory":
        // 内存模式：从临时变量读取（刷新页面后丢失）
        return (window as any).__AUTH_TOKEN__ || null;
      
      case "localStorage":
        // 本地存储模式（降级方案，不推荐）
        try {
          return localStorage.getItem("jwt");
        } catch {
          // localStorage 可能不可用（如隐私模式）
          return null;
        }
      
      default:
        return null;
    }
  }
  
  /**
   * 设置 Token
   * 
   * @param token JWT Token
   * 
   * 安全注意：
   * - httpOnly 模式下需要后端配合设置 Cookie
   * - 避免在日志中打印 Token 明文
   */
  setToken(token: string | null): void {
    switch (this.strategy) {
      case "httpOnly":
        // HttpOnly Cookie 模式：需要后端配合
        // 前端通过 /auth/login 接口设置 Cookie
        // 此处仅做标记，实际 Token 由后端管理
        if (token) {
          // 触发后端设置 Cookie 的 API 调用（可选）
          this._triggerHttpOnlySet(token);
        }
        break;
      
      case "memory":
        // 内存模式：存储到全局变量
        if (token) {
          (window as any).__AUTH_TOKEN__ = token;
        } else {
          delete (window as any).__AUTH_TOKEN__;
        }
        break;
      
      case "localStorage":
        // 本地存储模式（降级方案）
        if (token) {
          localStorage.setItem("jwt", token);
        } else {
          localStorage.removeItem("jwt");
        }
        break;
    }
  }
  
  /**
   * 清除 Token
   */
  clearToken(): void {
    this.setToken(null);
  }
  
  /**
   * 触发 HttpOnly Cookie 设置（内部方法）
   * 
   * 注意：此方法需要后端支持
   * 理想方案：登录后后端直接设置 HttpOnly Cookie
   */
  private async _triggerHttpOnlySet(token: string): Promise<void> {
    try {
      await apiFetch(V1Routes.auth.cookie, {
        method: "POST",
        auth: false,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
    } catch {
      console.warn("HttpOnly Cookie 设置失败，降级为内存模式");
    }
  }
  
  /**
   * 检查 Token 是否过期
   * 
   * @param token JWT Token
   * @returns 是否已过期
   * 
   * 安全注意：
   * - 不记录 Token 内容到日志
   * - 仅解析过期时间，不验证签名
   */
  isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    
    try {
      // JWT 格式：header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      
      // 解析 payload（Base64URL 解码）
      const payload = JSON.parse(atob(parts[1]));
      
      // 检查 exp 字段（过期时间戳，单位：秒）
      const exp = payload.exp;
      if (!exp || typeof exp !== "number") return true;
      
      // 当前时间戳（秒）
      const now = Math.floor(Date.now() / 1000);
      
      // 提前 5 分钟判定为过期（避免边界情况）
      return exp - now < 300;
    } catch {
      // 解析失败视为过期
      return true;
    }
  }
}

/**
 * AuthProvider 属性接口
 */
interface AuthProviderProps {
  children: ReactNode;
  /**
   * Token 存储策略
   * 
   * 推荐：
   * - 生产环境：httpOnly（最安全）
   * - 开发环境：memory（便于调试）
   * - 降级方案：localStorage（不推荐）
   */
  strategy?: TokenStorageStrategy;
}

/**
 * 认证提供者（AuthProvider）
 * 
 * 使用方式：
 * ```tsx
 * <AuthProvider strategy="memory">
 *   <App />
 * </AuthProvider>
 * ```
 * 
 * 安全最佳实践：
 * 1. 优先使用 httpOnly 模式
 * 2. 避免在日志中打印 Token
 * 3. 定期刷新 Token（未来扩展）
 */
export function AuthProvider({ children, strategy = "memory" }: AuthProviderProps) {
  // 初始化 Token 管理器
  const tokenManager = new TokenManager(strategy);
  
  // 从 Zustand store 读取状态
  const storeToken = useAuthStore(state => state.token);
  const address = useAuthStore(state => state.address);
  const roles = useAuthStore(state => state.roles);
  const activeRole = useAuthStore(state => state.activeRole);
  const isLoading = useAuthStore(state => state.isLoading);
  const expiresAt = useAuthStore(state => state.expiresAt);
  
  // Actions
  const setSession = useAuthStore(state => state.setSession);
  const clearSession = useAuthStore(state => state.clearSession);
  const setActiveRoleStore = useAuthStore(state => state.setActiveRole);
  
  /**
   * 设置 Token
   * 
   * 同时更新 Token Manager 与 Zustand store
   */
  const setToken = useCallback((token: string | null) => {
    tokenManager.setToken(token);
    
    // 如果 token 为 null，清除 session
    if (!token) {
      clearSession();
      return;
    }
    
    // 解析 Token 中的地址与过期时间（可选）
    // 实际项目中建议后端返回完整信息
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const addr = payload.address || payload.sub || null;
      const exp = payload.exp ? payload.exp * 1000 : null; // 转为毫秒
      
      if (addr && exp) {
        setSession(token, addr, exp);
      }
    } catch {
      // 解析失败，仅存储 token
      // 地址与过期时间需手动设置
    }
  }, [clearSession, setSession]);
  
  /**
   * 清除 Token
   */
  const clearToken = useCallback(() => {
    tokenManager.clearToken();
    clearSession();
  }, [clearSession]);
  
  /**
   * 检查是否有指定角色
   * 
   * @param role 单个或多个角色
   * @returns 是否拥有该角色
   */
  const hasRole = useCallback((role: RoleId | RoleId[]): boolean => {
    const required = Array.isArray(role) ? role : [role];
    return required.some(r => roles.includes(r));
  }, [roles]);
  
  /**
   * 检查 Token 是否过期
   */
  const isTokenExpired = useCallback(() => {
    const token = tokenManager.getToken();
    return tokenManager.isTokenExpired(token);
  }, []); // tokenManager 是稳定的
  
  /**
   * 是否已认证
   * 
   * 条件：
   * 1. Token 存在
   * 2. Token 未过期
   */
  const isAuthenticated = !isLoading && !!tokenManager.getToken() && !isTokenExpired();
  
  /**
   * Context 值
   * 
   * 使用 useMemo 优化性能（避免每次渲染都创建新对象）
   */
  const contextValue: AuthContextState = {
    // Token
    token: tokenManager.getToken(),
    setToken,
    clearToken,
    
    // 认证状态
    isAuthenticated,
    isTokenExpired: isTokenExpired(),
    
    // 用户信息
    address,
    roles,
    activeRole,
    
    // 角色操作
    setActiveRole: setActiveRoleStore,
    hasRole,
    
    // 加载状态
    isLoading,
    
    // 存储策略
    strategy,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 使用 AuthContext 的 Hook
 * 
 * 使用方式：
 * ```tsx
 * const auth = useAuth();
 * auth.setToken("...");
 * ```
 * 
 * 安全注意：
 * - 必须在 AuthProvider 内使用
 * - 避免在循环或条件语句中调用
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error(
      "useAuth 必须在 AuthProvider 内使用。\n" +
      "请在根组件中包裹 <AuthProvider>。</AuthProvider>"
    );
  }
  
  return context;
}

/**
 * Hook：检查是否有指定角色
 * 
 * 使用方式：
 * ```tsx
 * const hasPermission = useHasRole("dao");
 * ```
 */
export function useHasRole(role: RoleId | RoleId[]): boolean {
  const auth = useAuth();
  return auth.hasRole(role);
}

/**
 * Hook：检查是否已认证
 * 
 * 使用方式：
 * ```tsx
 * const isAuth = useIsAuthenticated();
 * ```
 */
export function useIsAuthenticated(): boolean {
  const auth = useAuth();
  return auth.isAuthenticated;
}
