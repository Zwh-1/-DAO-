/**
 * WASM 预加载工具
 * 
 * 功能：
 * - 预加载电路 WASM 文件
 * - 支持并行加载
 * - 支持缓存管理
 * 
 * 性能优化：
 * - 并行加载多个 WASM 文件
 * - 使用浏览器缓存
 * - 支持按需加载
 */

/**
 * 电路配置
 */
interface CircuitConfig {
  /** 电路名称 */
  name: string;
  /** WASM 路径 */
  wasmPath: string;
  /** 优先级（1-5，1 最高） */
  priority: number;
}

/**
 * 电路缓存
 */
const circuitCache = new Map<string, ArrayBuffer>();

/**
 * 加载状态
 */
const loadingStatus = new Map<string, {
  loaded: boolean;
  loading: boolean;
  error: Error | null;
}>();

/**
 * 电路列表
 */
const CIRCUITS: CircuitConfig[] = [
  {
    name: 'identity',
    wasmPath: '/circuits/identity.wasm',
    priority: 1,
  },
  {
    name: 'anonymousClaim',
    wasmPath: '/circuits/anonymous_claim.wasm',
    priority: 2,
  },
];

/**
 * 加载单个电路 WASM
 * 
 * @param wasmPath WASM 文件路径
 * @param force 是否强制重新加载（忽略缓存）
 * @returns WASM 二进制数据
 */
export async function loadCircuit(
  wasmPath: string,
  force: boolean = false
): Promise<ArrayBuffer> {
  console.log('[WASM] 加载电路:', wasmPath);

  // 检查缓存
  if (!force && circuitCache.has(wasmPath)) {
    console.log('[WASM] 使用缓存:', wasmPath);
    return circuitCache.get(wasmPath)!;
  }

  // 检查加载状态
  const status = loadingStatus.get(wasmPath);
  if (status?.loading && !force) {
    console.log('[WASM] 等待加载完成:', wasmPath);
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const s = loadingStatus.get(wasmPath);
        if (s?.loaded) {
          resolve(circuitCache.get(wasmPath)!);
        } else if (s?.error) {
          reject(s.error);
        } else {
          setTimeout(checkStatus, 100);
        }
      };
      checkStatus();
    });
  }

  // 设置加载状态
  loadingStatus.set(wasmPath, { loaded: false, loading: true, error: null });

  try {
    // 加载 WASM
    const response = await fetch(wasmPath);
    
    if (!response.ok) {
      throw new Error(`加载失败：${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    // 缓存
    circuitCache.set(wasmPath, buffer);

    // 更新状态
    loadingStatus.set(wasmPath, { loaded: true, loading: false, error: null });

    console.log('[WASM] 加载完成:', wasmPath);

    return buffer;
  } catch (error) {
    // 更新错误状态
    loadingStatus.set(wasmPath, { 
      loaded: false, 
      loading: false, 
      error: error instanceof Error ? error : new Error('加载失败') 
    });

    console.error('[WASM] 加载失败:', wasmPath, error);
    throw error;
  }
}

/**
 * 并行加载多个电路
 * 
 * @param circuits 电路配置列表
 * @returns 加载结果
 */
export async function preloadCircuits(
  circuits: CircuitConfig[] = CIRCUITS
): Promise<{ success: number; failed: number }> {
  console.log('[WASM] 开始预加载电路');

  const startTime = Date.now();

  // 按优先级排序
  const sortedCircuits = [...circuits].sort((a, b) => a.priority - b.priority);

  // 并行加载
  const promises = sortedCircuits.map((circuit) =>
    loadCircuit(circuit.wasmPath)
      .then(() => ({ name: circuit.name, success: true }))
      .catch((error) => {
        console.error(`[WASM] 电路 ${circuit.name} 加载失败:`, error);
        return { name: circuit.name, success: false, error };
      })
  );

  const results = await Promise.all(promises);
  const success = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const endTime = Date.now();

  console.log('[WASM] 预加载完成:', {
    success,
    failed,
    totalTime: `${endTime - startTime}ms`,
  });

  return { success, failed };
}

/**
 * 预加载所有电路
 */
export async function preloadAllCircuits(): Promise<{ success: number; failed: number }> {
  return preloadCircuits(CIRCUITS);
}

/**
 * 清除缓存
 * 
 * @param wasmPath 可选的 WASM 路径，不提供则清除所有缓存
 */
export function clearCache(wasmPath?: string): void {
  if (wasmPath) {
    circuitCache.delete(wasmPath);
    loadingStatus.delete(wasmPath);
    console.log('[WASM] 缓存已清除:', wasmPath);
  } else {
    circuitCache.clear();
    loadingStatus.clear();
    console.log('[WASM] 所有缓存已清除');
  }
}

/**
 * 获取加载状态
 */
export function getLoadingStatus(wasmPath: string): {
  loaded: boolean;
  loading: boolean;
  error: Error | null;
} | null {
  return loadingStatus.get(wasmPath) || null;
}

/**
 * 导出所有工具
 */
export const wasmLoader = {
  loadCircuit,
  preloadCircuits,
  preloadAllCircuits,
  clearCache,
  getLoadingStatus,
};
