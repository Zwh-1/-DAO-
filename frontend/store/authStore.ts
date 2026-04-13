// ==================== 导入依赖 ====================
import { create } from "zustand"; // Zustand 核心 API
import { createJSONStorage, persist } from "zustand/middleware"; // 持久化中间件

// ==================== 类型定义 ====================

/**
 * 角色 ID 的联合类型
 * 限制只能使用这 6 种角色字符串，避免拼写错误
 */
export type RoleId = "member" | "arbitrator" | "challenger" | "oracle" | "guardian" | "dao";

/**
 * 角色 ID 到中文名称的映射表
 * 用于在 UI 上显示友好的角色名称
 */
export const ROLE_LABEL: Record<RoleId, string> = {
  member: "成员",
  arbitrator: "仲裁员",
  challenger: "挑战者",
  oracle: "预言机",
  guardian: "守护者",
  dao: "DAO 成员",
};

/**
 * Store 的完整状态类型定义
 * 包含所有状态字段和可用的 actions
 */
type AuthState = {
  // ---------- 认证相关 ----------
  token: string | null;          // JWT 访问令牌，null 表示未登录
  address: string | null;        // 用户钱包地址
  expiresAt: number | null;      // token 过期时间戳（毫秒）
  isLoading: boolean;            // 是否正在执行登录/刷新等异步操作

  // ---------- 钱包相关 ----------
  walletRuntime: "injected" | "embedded" | null; // 钱包运行环境（如 MetaMask 注入或内嵌）
  chainIdHex: string | null;     // 当前区块链网络 ID（十六进制，如 "0x1"）
  walletSessionState:            // 钱包会话的详细状态
    | "idle"
    | "locked"
    | "unlocked"
    | "pendingApproval"
    | "signing"
    | "submitted"
    | "failed";

  // ---------- 角色相关 ----------
  roles: RoleId[];               // 当前用户拥有的所有角色（可能多个）
  activeRole: RoleId | null;     // 当前激活的角色（用于切换身份）

  // ---------- Actions ----------
  setSession: (token: string, address: string, expiresAt: number) => void;
  clearSession: () => void;
  setLoading: (isLoading: boolean) => void;
  setWalletRuntime: (runtime: "injected" | "embedded" | null) => void;
  setWalletChainId: (chainIdHex: string | null) => void;
  setWalletSessionState: (state: AuthState["walletSessionState"]) => void;
  setRoles: (roles: RoleId[]) => void;
  setActiveRole: (role: RoleId | null) => void;
  // 批量更新钱包信息（一次性修改多个字段）
  updateWallet: (updates: Partial<Pick<AuthState, "walletRuntime" | "chainIdHex" | "walletSessionState">>) => void;

  // ---------- 派生状态（计算属性）----------
  // 注意：这些不是 store 中存储的字段，而是在 select 时动态计算的函数
  // 为了方便使用，我们将其作为方法定义在 store 中，实际调用时通过 state 计算
  isAuthenticated: () => boolean;   // 是否已登录且 token 未过期
  isTokenExpired: () => boolean;    // token 是否已过期
};

// ==================== 创建 Store ====================

/**
 * 使用 Zustand 创建认证 store，并应用持久化中间件
 * 持久化配置：仅存储 address、roles、activeRole 等非敏感信息，token 不持久化
 */
export const useAuthStore = create<AuthState>()(
  persist(
    // 第一个参数：store 的定义函数，接收 set、get 两个参数
    (set, get) => ({
      // ---------- 初始状态 ----------
      token: null,
      address: null,
      expiresAt: null,
      isLoading: false,
      walletRuntime: null,
      chainIdHex: null,
      walletSessionState: "idle",
      roles: [],
      activeRole: null,

      // ---------- Actions 实现 ----------

      /**
       * 设置登录会话
       * @param token - 访问令牌
       * @param address - 钱包地址
       * @param expiresAt - 过期时间戳
       */
      setSession: (token, address, expiresAt) =>
        set({ token, address, expiresAt, isLoading: false }), // 同时将 loading 设为 false

      /**
       * 清除所有认证和钱包信息（退出登录）
       * 注意：不会清除持久化存储中的 address/roles 等（因为我们配置了 partialize 仅存储非敏感信息）
       * 如果希望彻底清除，可以调用 store 的 persist API 手动清除，但通常保持现状即可
       */
      clearSession: () =>
        set({
          token: null,
          address: null,
          expiresAt: null,
          isLoading: false,
          walletRuntime: null,
          chainIdHex: null,
          walletSessionState: "idle",
          roles: [],
          activeRole: null,
        }),

      /**
       * 设置加载状态
       * @param isLoading - 是否正在加载
       */
      setLoading: (isLoading) => set({ isLoading }),

      setWalletRuntime: (walletRuntime) => set({ walletRuntime }),
      setWalletChainId: (chainIdHex) => set({ chainIdHex }),
      setWalletSessionState: (walletSessionState) => set({ walletSessionState }),
      setRoles: (roles) => set({ roles }),
      setActiveRole: (activeRole) => set({ activeRole }),

      /**
       * 批量更新钱包相关字段
       * @param updates - 包含要更新的字段的对象
       */
      updateWallet: (updates) => set(updates),

      // ---------- 派生状态方法 ----------

      /**
       * 判断用户是否已认证（已登录且 token 未过期）
       * @returns true 表示已认证，false 表示未认证或 token 过期
       */
      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token || !expiresAt) return false;
        // 当前时间戳（毫秒）小于过期时间则有效
        return Date.now() < expiresAt;
      },

      /**
       * 判断 token 是否已过期
       * @returns true 表示已过期，false 表示未过期或没有 token
       */
      isTokenExpired: () => {
        const { expiresAt } = get();
        return expiresAt ? Date.now() >= expiresAt : true;
      },
    }),
    {
      name: "trustaid-auth",                         // localStorage 中存储的键名
      storage: createJSONStorage(() => localStorage), // 使用 localStorage 作为存储引擎
      /**
       * 部分持久化：只持久化非敏感且需要在刷新后保留的字段
       * token、expiresAt、isLoading 等敏感或临时状态不存储，避免安全风险
       */
      partialize: (state) => ({
        address: state.address,
        roles: state.roles,
        activeRole: state.activeRole,
        walletRuntime: state.walletRuntime,
        chainIdHex: state.chainIdHex,
        walletSessionState: state.walletSessionState,
      }),
    }
  )
);