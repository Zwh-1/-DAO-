/**
 * WASM 预加载 Hook
 * 
 * 功能：
 * - 应用启动时预加载电路
 * - 显示加载进度
 * - 支持错误处理
 * 
 * 性能优化：
 * - 并行加载
 * - 按需加载
 * - 缓存管理
 */

import { useState, useEffect, useCallback } from 'react';
import { preloadAllCircuits, getLoadingStatus, clearCache } from '../lib/zk/wasmLoader';

/**
 * 预加载状态
 */
interface PreloadState {
  /** 是否已加载完成 */
  isLoaded: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 加载进度（0-100） */
  progress: number;
  /** 错误信息 */
  error: string | null;
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
}

/**
 * WASM 预加载 Hook
 */
export function useWasmPreload() {
  const [state, setState] = useState<PreloadState>({
    isLoaded: false,
    isLoading: true,
    progress: 0,
    error: null,
    successCount: 0,
    failedCount: 0,
  });

  /**
   * 重新加载
   */
  const reload = useCallback(async () => {
    console.log('[WasmPreload] 重新加载');

    // 清除缓存
    clearCache();

    // 重置状态
    setState((prev) => ({
      ...prev,
      isLoading: true,
      progress: 0,
      error: null,
    }));

    try {
      // 预加载所有电路
      const result = await preloadAllCircuits();

      // 计算进度
      const total = result.success + result.failed;
      const progress = total > 0 ? Math.round((result.success / total) * 100) : 0;

      // 更新状态
      setState({
        isLoaded: result.failed === 0,
        isLoading: false,
        progress,
        error: result.failed > 0 ? `部分电路加载失败（${result.failed} 个）` : null,
        successCount: result.success,
        failedCount: result.failed,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '加载失败',
      }));
    }
  }, []);

  /**
   * 初次加载
   */
  useEffect(() => {
    reload();
  }, [reload]);

  return {
    ...state,
    reload,
  };
}

/**
 * 导出默认 Hook
 */
export default useWasmPreload;
