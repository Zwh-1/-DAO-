// ==================== 导入依赖 ====================
import { create, StateCreator, StoreApi, UseBoundStore } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { produce } from "immer"; 

// ==================== 类型定义 ====================

/**
 * ZK 证明生成阶段
 */
export type ZkPhase = "idle" | "loading" | "generating" | "success" | "error";

/**
 * 结构化错误类型
 */
export interface ZkError {
  message: string;
  code?: string | number;
  details?: unknown;
}

/**
 * 合法状态转换映射表
 * key: 当前阶段, value: 允许转换到的阶段数组
 */
const allowedTransitions: Record<ZkPhase, ZkPhase[]> = {
  idle: ["loading", "generating", "success", "error"],
  loading: ["generating", "error"],
  generating: ["success", "error"],
  success: ["idle"],      // 只能重置回 idle
  error: ["idle", "loading"],
};

/**
 * Store 配置选项
 */
export interface ZkStoreOptions<TProof = unknown> {
  /** 是否启用持久化（存储到 localStorage） */
  persist?: boolean;
  /** 持久化存储的 key（默认 "zk-store"） */
  persistKey?: string;
  /** 是否启用 Redux DevTools（默认 true） */
  devtools?: boolean;
  /** 开发环境日志（默认 true） */
  log?: boolean;
  /** 状态变更回调（用于埋点或副作用） */
  onStateChange?: (state: ZkState<TProof>) => void;
  /** 进度更新节流时间（ms），避免高频更新，默认 50ms */
  progressThrottle?: number;
}

/**
 * Store 状态接口（泛型 TProof 为证明数据类型）
 */
export interface ZkState<TProof = unknown> {
  // ---------- 状态字段 ----------
  phase: ZkPhase;
  progress: number;
  message: string;
  lastProof: TProof | null;
  lastError: ZkError | null;
  // 元数据
  startTime: number | null;      // 开始生成的时间戳
  duration: number | null;       // 生成耗时（ms）

  // ---------- Actions ----------
  setPhase: (phase: ZkPhase, message?: string) => void;
  setProgress: (progress: number) => void;
  setProof: (proof: TProof, message?: string) => void;
  setError: (error: string | ZkError, message?: string) => void;
  reset: () => void;

  // 派生状态
  isProcessing: () => boolean;
  isFinished: () => boolean;
  isIdle: () => boolean;
  canTransitionTo: (target: ZkPhase) => boolean;
}

// ==================== 辅助函数 ====================

/**
 * 检查阶段转换是否合法
 */
function isTransitionAllowed(from: ZkPhase, to: ZkPhase): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

/**
 * 将字符串错误转换为 ZkError
 */
function normalizeError(error: string | ZkError): ZkError {
  if (typeof error === "string") {
    return { message: error };
  }
  return error;
}

// ==================== Store 工厂函数 ====================

/**
 * 创建 ZK 证明状态 store（支持泛型）
 * @param options - 配置选项
 * @returns Zustand store hook
 */
export function createZkStore<TProof = unknown>(
  options: ZkStoreOptions<TProof> = {}
): UseBoundStore<StoreApi<ZkState<TProof>>> {
  const {
    persist: enablePersist = false,
    persistKey = "zk-store",
    devtools: enableDevtools = true,
    log: enableLog = true,
    onStateChange,
    progressThrottle = 50,
  } = options;

  // 节流计时器
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingProgress: number | null = null;

  // 创建基础 store 的 creator
  const storeCreator: StateCreator<ZkState<TProof>> = (set, get) => ({
    // 初始状态
    phase: "idle",
    progress: 0,
    message: "",
    lastProof: null,
    lastError: null,
    startTime: null,
    duration: null,

    // 设置阶段（带合法性检查）
    setPhase: (phase, message) => {
      const currentPhase = get().phase;
      if (!isTransitionAllowed(currentPhase, phase)) {
        if (enableLog) {
          console.warn(
            `[ZkStore] 非法状态转换: ${currentPhase} -> ${phase}，已忽略`
          );
        }
        return;
      }

      const update: Partial<ZkState<TProof>> = { phase };
      if (message !== undefined) {
        update.message = message;
      }

      // 记录开始时间
      if (phase === "loading" || phase === "generating") {
        update.startTime = Date.now();
        update.duration = null;
      }

      // 记录结束时间
      if (phase === "success" || phase === "error") {
        const startTime = get().startTime;
        if (startTime) {
          update.duration = Date.now() - startTime;
        }
      }

      set(update);
    },

    // 设置进度（节流）
    setProgress: (progress) => {
      const clamped = Math.min(100, Math.max(0, progress));
      const currentPhase = get().phase;

      // 只有在 loading 或 generating 阶段才允许更新进度
      if (currentPhase !== "loading" && currentPhase !== "generating") {
        if (enableLog) {
          console.warn(`[ZkStore] 在阶段 ${currentPhase} 设置进度已被忽略`);
        }
        return;
      }

      // 节流更新
      if (progressThrottle > 0) {
        pendingProgress = clamped;
        if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            if (pendingProgress !== null) {
              set({ progress: pendingProgress });
              pendingProgress = null;
            }
            throttleTimer = null;
          }, progressThrottle);
        }
      } else {
        set({ progress: clamped });
      }
    },

    // 设置证明（自动切换为 success）
    setProof: (proof, message) => {
      const currentPhase = get().phase;
      if (!isTransitionAllowed(currentPhase, "success")) {
        console.warn(`[ZkStore] 从 ${currentPhase} 无法转换到 success`);
        return;
      }

      set({
        lastProof: proof,
        lastError: null,
        phase: "success",
        message: message ?? "证明生成成功",
        duration: get().startTime ? Date.now() - (get().startTime ?? 0) : null,
      });
    },

    // 设置错误（自动切换为 error）
    setError: (error, message) => {
      const currentPhase = get().phase;
      if (!isTransitionAllowed(currentPhase, "error")) {
        console.warn(`[ZkStore] 从 ${currentPhase} 无法转换到 error`);
        return;
      }

      const normalizedError = normalizeError(error);
      set({
        lastError: normalizedError,
        lastProof: null,
        phase: "error",
        message: message ?? normalizedError.message,
        duration: get().startTime ? Date.now() - (get().startTime ?? 0) : null,
      });
    },

    // 重置所有状态
    reset: () => {
      set({
        phase: "idle",
        progress: 0,
        message: "",
        lastProof: null,
        lastError: null,
        startTime: null,
        duration: null,
      });
    },

    // 派生状态
    isProcessing: () => {
      const { phase } = get();
      return phase === "loading" || phase === "generating";
    },
    isFinished: () => {
      const { phase } = get();
      return phase === "success" || phase === "error";
    },
    isIdle: () => {
      const { phase } = get();
      return phase === "idle";
    },
    canTransitionTo: (target) => {
      return isTransitionAllowed(get().phase, target);
    },
  });

  // 应用中间件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalCreator: any = storeCreator;

  if (enableDevtools && typeof window !== "undefined") {
    finalCreator = devtools(finalCreator, { name: "ZK Store" });
  }

  if (enablePersist) {
    finalCreator = persist(finalCreator, {
      name: persistKey,
      storage: typeof window !== "undefined" ? createJSONStorage(() => localStorage) : undefined,
      // 仅持久化非敏感且需要恢复的字段
      partialize: (state: ZkState<TProof>) => ({
        phase: state.phase,
        progress: state.progress,
        message: state.message,
        lastProof: state.lastProof,
        // 不持久化 lastError, startTime, duration
      }),
    });
  }

  // 创建 store
  const store = create(finalCreator);

  // 可选：添加全局状态变更监听
  if (onStateChange) {
    // 简单实现：订阅 store 变化
    const unsubscribe = store.subscribe((state) => {
      onStateChange(state as ZkState<TProof>);
    });
    // 注意：这里没有返回 unsubscribe，通常不需要清理，因为 store 是单例
    // 但为了完整，可以挂载到 store 上
    (store as any).__unsubscribeStateChange = unsubscribe;
  }

  // 开发环境日志：订阅并打印
  if (enableLog && process.env.NODE_ENV === "development") {
    store.subscribe((state, prevState) => {
      if (state !== prevState) {
        console.group("[ZkStore] 状态变更");
        console.log("之前:", prevState);
        console.log("之后:", state);
        console.groupEnd();
      }
    });
  }

  return store as UseBoundStore<StoreApi<ZkState<TProof>>>;
}

// ==================== 默认导出（使用默认配置） ====================

/**
 * 默认的 ZK Store 实例（使用 unknown 类型）
 * 大多数情况直接使用这个即可
 */
export const useZkStore = createZkStore({
  persist: false,
  devtools: true,
  log: true,
});

// ==================== 工具函数 ====================

/**
 * 重置 store 到初始状态（用于测试或退出登录）
 */
export function resetZkStore() {
  useZkStore.getState().reset();
}

/**
 * 获取 store 当前状态的快照（非响应式）
 */
export function getZkStoreSnapshot() {
  return useZkStore.getState();
}