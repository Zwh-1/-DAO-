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

/** UI 中角色切换的展示顺序（侧栏、钱包页等保持一致） */
export const ROLE_ORDER: readonly RoleId[] = [
  "member",
  "challenger",
  "dao",
  "arbitrator",
  "oracle",
  "guardian",
];

/**
 * 钱包会话状态机（严格五状态模型）
 * 
 * 状态流转：
 * IDLE（初始化） 
 *   ↓ 用户点击连接
 * CONNECTING（连接中）
 *   ↓ 等待用户确认
 * PENDING_APPROVAL（等待确认）
 *   ↓ 连接成功
 * UNLOCKED（已解锁/就绪）
 *   ↓ 用户锁定或超时
 * LOCKED（已锁定/需输入密码）
 *   ↓ 用户断开
 * DISCONNECTED（断开）
 * 
 * 错误状态：FAILED（任何状态都可能因错误进入 FAILED）
 */
export type WalletSessionState =
  | 'idle'           // 初始状态：未开始连接
  | 'connecting'     // 连接中：等待用户授权或钱包响应
  | 'pendingApproval' // 等待用户确认（钱包弹窗中）
  | 'unlocked'       // 已解锁：钱包就绪，可签名/交易
  | 'locked'         // 已锁定：内置钱包需要密码解锁
  | 'disconnected'   // 已断开：用户主动断开或钱包插件断开
  | 'failed'         // 失败：连接/签名过程中发生错误

/** 连接来源（runtime=injected 时区分 MetaMask / WalletConnect） */
export type WalletConnectorKind = "injected" | "walletconnect" | "embedded";

/**
 * Store 的完整状态类型定义
 * 包含所有状态字段和可用的 actions
 */
type AuthState = {
  // ---------- 认证相关 ----------
  token: string | null;          // JWT 访问令牌，null 表示未登录
  address: string | null;        // 用户钱包地址（脱敏显示）
  expiresAt: number | null;      // token 过期时间戳（毫秒）
  isLoading: boolean;            // 是否正在执行登录/刷新等异步操作

  // ---------- 钱包相关（状态机治理）----------
  walletRuntime: "injected" | "embedded" | null; // 钱包运行环境
  /** 与 walletRuntime 配合：embedded 为内置钱包；injected 下区分浏览器插件与 WalletConnect */
  walletConnector: WalletConnectorKind | null;
  chainIdHex: string | null;     // 链 ID（十六进制）
  walletChainId: number | null;  // 链 ID（十进制）
  walletSessionState: WalletSessionState; // 钱包会话状态机
  error: string | null;          // 错误信息（带错误码）
  errorCode: string | null;      // 错误码（如 USER_REJECTED, NETWORK_ERROR）

  // ---------- 角色相关 ----------
  roles: RoleId[];               // 用户角色列表
  activeRole: RoleId | null;     // 当前激活角色

  // ---------- Actions ----------
  /** activeRole 可选：传入时同步更新当前身份（与 JWT 内 activeRole 一致） */
  setSession: (token: string, address: string, expiresAt: number, activeRole?: RoleId | null) => void;
  clearSession: () => void;
  setLoading: (isLoading: boolean) => void;
  
  // 钱包状态机专用 Actions
  setWalletRuntime: (runtime: "injected" | "embedded" | null) => void;
  setWalletConnector: (connector: WalletConnectorKind | null) => void;
  setWalletChainId: (chainIdHex: string | null) => void;
  setWalletSessionState: (state: WalletSessionState) => void;
  setWalletError: (error: string | null, errorCode?: string | null) => void;
  clearWalletError: () => void;
  
  setRoles: (roles: RoleId[]) => void;
  setActiveRole: (role: RoleId | null) => void;
  setAddress: (address: string | null) => void;
  
  // 批量更新钱包信息
  updateWallet: (updates: Partial<Pick<AuthState, "walletRuntime" | "walletConnector" | "chainIdHex" | "walletChainId" | "walletSessionState" | "error" | "errorCode">>) => void;

  // ---------- 派生状态（计算属性）----------
  isAuthenticated: () => boolean;   // 是否已登录且 token 未过期
  isTokenExpired: () => boolean;    // token 是否已过期
  isWalletConnected: () => boolean; // 钱包是否已连接（UNLOCKED 状态）
  isWalletConnecting: () => boolean; // 钱包是否正在连接
  hasWalletError: () => boolean;    // 钱包是否有错误
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
      walletConnector: null,
      chainIdHex: null,
      walletChainId: null,
      walletSessionState: 'idle', // 状态机初始状态
      error: null,
      errorCode: null,
      roles: [],
      activeRole: null,

      // ---------- Actions 实现 ----------

      /**
       * 设置登录会话
       * @param token - 访问令牌
       * @param address - 钱包地址
       * @param expiresAt - 过期时间戳
       */
      setSession: (token, address, expiresAt, activeRole) =>
        set({
          token,
          address,
          expiresAt,
          isLoading: false,
          ...(activeRole !== undefined ? { activeRole } : {}),
        }),

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
          walletConnector: null,
          chainIdHex: null,
          walletChainId: null,
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
      setWalletConnector: (walletConnector) => set({ walletConnector }),
      setWalletChainId: (chainIdHex) => {
        const walletChainId =
          chainIdHex && /^0x[0-9a-fA-F]+$/.test(chainIdHex)
            ? parseInt(chainIdHex, 16)
            : null;
        set({ chainIdHex, walletChainId });
      },
      
      /**
       * 设置钱包会话状态（状态机流转）
       * 
       * 状态流转规则：
       * - 进入 'connecting' 时自动清除错误
       * - 进入 'unlocked' 时清除错误和连接状态
       * - 进入 'failed' 时必须设置 error 和 errorCode
       */
      setWalletSessionState: (walletSessionState) => {
        const state = get()
        
        // 状态流转时的自动清理
        if (walletSessionState === 'connecting') {
          // 开始新连接，清除旧错误
          set({ walletSessionState, error: null, errorCode: null })
        } else if (walletSessionState === 'unlocked') {
          // 连接成功，清除错误
          set({ walletSessionState, error: null, errorCode: null })
        } else {
          set({ walletSessionState })
        }
      },
      
      /**
       * 设置钱包错误
       * 
       * @param error 错误信息（用户友好提示）
       * @param errorCode 错误码（用于程序判断）
       */
      setWalletError: (error, errorCode = null) => {
        set({ error, errorCode })
        
        // 严重错误时切换到 failed 状态
        if (error) {
          const state = get()
          if (state.walletSessionState !== 'failed') {
            set({ walletSessionState: 'failed' })
          }
        }
      },
      
      /**
       * 清除钱包错误
       */
      clearWalletError: () => set({ error: null, errorCode: null }),
      
      setRoles: (roles) => set({ roles }),
      setActiveRole: (activeRole) => set({ activeRole }),
      setAddress: (address) => set({ address }),
      
      /**
       * 批量更新钱包相关字段
       * @param updates - 包含要更新的字段的对象
       */
      updateWallet: (updates) => {
        // 如果更新了 error 字段，自动设置 errorCode
        if (updates.error && !updates.errorCode) {
          updates.errorCode = 'UNKNOWN_ERROR'
        }
        set(updates)
      },

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

      /**
       * 判断钱包是否已连接（UNLOCKED 状态）
       * 
       * 返回 true 的条件：
       * 1. 地址不为空
       * 2. 状态机处于 'unlocked' 状态
       */
      isWalletConnected: () => {
        const { address, walletSessionState } = get();
        return !!address && walletSessionState === 'unlocked';
      },

      /**
       * 判断钱包是否正在连接
       * 
       * 返回 true 的条件：
       * 1. 状态机处于 'connecting' 状态
       */
      isWalletConnecting: () => {
        const { walletSessionState } = get();
        return walletSessionState === 'connecting';
      },

      /**
       * 判断钱包是否有错误
       * 
       * 返回 true 的条件：
       * 1. error 字段不为空
       * 2. 或状态机处于 'failed' 状态
       */
      hasWalletError: () => {
        const { error, walletSessionState } = get();
        return !!error || walletSessionState === 'failed';
      },

      /**
       * 判断钱包是否需要解锁（内置钱包）
       * 
       * 返回 true 的条件：
       * 1. 状态机处于 'locked' 状态
       */
      isWalletLocked: () => {
        const { walletSessionState } = get();
        return walletSessionState === 'locked';
      },

      /**
       * 判断钱包是否已断开
       */
      isWalletDisconnected: () => {
        const { walletSessionState } = get();
        return walletSessionState === 'disconnected' || walletSessionState === 'idle';
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
        // 持久化非敏感字段，刷新后保留
        address: state.address,
        roles: state.roles,
        activeRole: state.activeRole,
        walletRuntime: state.walletRuntime,
        walletConnector: state.walletConnector,
        chainIdHex: state.chainIdHex,
        walletChainId: state.walletChainId,
        walletSessionState: state.walletSessionState,
        // JWT 持久化：刷新后静默恢复登录态，过期由 useCheckAuth 校验后清除
        token: state.token,
        expiresAt: state.expiresAt,
        // 注意：error 和 errorCode 不持久化，避免刷新后仍显示旧错误
      }),
    }
  )
);