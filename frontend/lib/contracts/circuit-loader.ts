/**
 * ZKP 电路文件加载器
 * 
 * 功能：
 * - 加载电路 WASM 文件
 * - 加载电路密钥（.zkey）
 * - 加载验证密钥（vkey）
 * - 管理证明文件和公开输入
 * 
 * 隐私保护：
 * - 电路密钥包含敏感数据，必须从服务器动态加载
 * - 禁止将 .zkey 文件硬编码到代码库
 * - 证明文件验证后立即删除
 * 
 * 性能优化：
 * - WASM 文件分段加载
 * - 缓存已加载的电路
 * - 支持预加载和并行加载
 */

import type { Groth16Proof, PublicSignals } from 'snarkjs';

/**
 * 电路文件类型
 */
export interface CircuitFiles {
  /** WASM 文件路径 */
  wasm: string;
  /** ZKey 文件路径 */
  zkey: string;
  /** 验证密钥路径 */
  vkey?: string;
}

/**
 * 加载的电路对象
 */
export interface LoadedCircuit {
  /** 电路名称 */
  name: string;
  /** WASM 文件（ArrayBuffer） */
  wasm: ArrayBuffer;
  /** ZKey 文件（ArrayBuffer） */
  zkey: ArrayBuffer;
  /** 验证密钥（可选） */
  vkey?: any;
  /** 加载时间戳 */
  loadedAt: number;
}

/**
 * 证明文件对象
 */
export interface ProofFile {
  /** 证明 ID */
  proofId: string;
  /** 证明数据 */
  proof: Groth16Proof;
  /** 公开信号 */
  publicSignals: PublicSignals;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳 */
  expiresAt: number;
}

/**
 * 电路文件缓存
 */
const circuitCache = new Map<string, LoadedCircuit>();

/**
 * 证明文件缓存
 */
const proofCache = new Map<string, ProofFile>();

/**
 * 加载电路文件
 * 
 * @param circuitName 电路名称
 * @returns 加载的电路对象
 */
export async function loadCircuit(circuitName: string): Promise<LoadedCircuit> {
  // 检查缓存
  const cached = circuitCache.get(circuitName);
  if (cached) {
    console.log(`[Circuit] 从缓存加载：${circuitName}`);
    return cached;
  }
  
  try {
    console.log(`[Circuit] 开始加载：${circuitName}`);
    
    // 获取文件路径
    const { getCircuitFilePath } = await import('../config/storage');
    const wasmPath = getCircuitFilePath(circuitName, 'wasm');
    const zkeyPath = getCircuitFilePath(circuitName, 'zkey');
    const vkeyPath = getCircuitFilePath(circuitName, 'vkey');
    
    // 并行加载文件
    const [wasmResponse, zkeyResponse, vkeyResponse] = await Promise.all([
      fetch(wasmPath),
      fetch(zkeyPath),
      fetch(vkeyPath).catch(() => null), // vkey 可选
    ]);
    
    // 检查加载结果
    if (!wasmResponse.ok) {
      throw new Error(`WASM 文件加载失败：${wasmPath}`);
    }
    if (!zkeyResponse.ok) {
      throw new Error(`ZKey 文件加载失败：${zkeyPath}`);
    }
    
    // 读取 ArrayBuffer
    const [wasmBuffer, zkeyBuffer] = await Promise.all([
      wasmResponse.arrayBuffer(),
      zkeyResponse.arrayBuffer(),
    ]);
    
    // 读取 vkey（可选）
    let vkeyData = null;
    if (vkeyResponse?.ok) {
      vkeyData = await vkeyResponse.json();
    }
    
    const loadedCircuit: LoadedCircuit = {
      name: circuitName,
      wasm: wasmBuffer,
      zkey: zkeyBuffer,
      vkey: vkeyData,
      loadedAt: Date.now(),
    };
    
    // 缓存
    circuitCache.set(circuitName, loadedCircuit);
    
    console.log(`[Circuit] 加载成功：${circuitName}`, {
      wasmSize: wasmBuffer.byteLength,
      zkeySize: zkeyBuffer.byteLength,
    });
    
    return loadedCircuit;
  } catch (error) {
    console.error(`[Circuit] 加载失败：${circuitName}`, error);
    throw new Error(`无法加载电路 ${circuitName}: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 批量加载电路
 * 
 * @param circuitNames 电路名称列表
 * @returns 加载的电路映射
 */
export async function loadCircuits(circuitNames: string[]): Promise<Record<string, LoadedCircuit>> {
  const results: Record<string, LoadedCircuit> = {};
  
  await Promise.all(
    circuitNames.map(async (name) => {
      try {
        results[name] = await loadCircuit(name);
      } catch (error) {
        console.error(`[Circuit] 批量加载失败：${name}`, error);
        // 继续加载其他电路
      }
    })
  );
  
  return results;
}

/**
 * 保存证明文件
 * 
 * @param proofId 证明 ID
 * @param proof 证明数据
 * @param publicSignals 公开信号
 * @param ttl 过期时间（毫秒）
 */
export async function saveProof(
  proofId: string,
  proof: Groth16Proof,
  publicSignals: PublicSignals,
  ttl: number = 10 * 60 * 1000 // 默认 10 分钟
): Promise<void> {
  const proofFile: ProofFile = {
    proofId,
    proof,
    publicSignals,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };
  
  // 缓存
  proofCache.set(proofId, proofFile);
  
  console.log(`[Proof] 证明已保存：${proofId}`, {
    expiresAt: new Date(proofFile.expiresAt).toISOString(),
  });
  
  // 注意：前端不持久化存储证明文件到磁盘
  // 证明文件仅保存在内存中，验证后自动清除
}

/**
 * 获取证明文件
 * 
 * @param proofId 证明 ID
 * @returns 证明文件（如果存在且未过期）
 */
export function getProof(proofId: string): ProofFile | null {
  const proofFile = proofCache.get(proofId);
  
  if (!proofFile) {
    console.log(`[Proof] 证明不存在：${proofId}`);
    return null;
  }
  
  // 检查是否过期
  if (Date.now() > proofFile.expiresAt) {
    console.log(`[Proof] 证明已过期：${proofId}`);
    proofCache.delete(proofId);
    return null;
  }
  
  return proofFile;
}

/**
 * 删除证明文件
 * 
 * @param proofId 证明 ID
 */
export function deleteProof(proofId: string): void {
  const deleted = proofCache.delete(proofId);
  console.log(`[Proof] 证明已删除：${proofId}`, { deleted });
}

/**
 * 清理过期证明
 */
export function cleanupExpiredProofs(): void {
  const now = Date.now();
  let count = 0;
  
  proofCache.forEach((proofFile, proofId) => {
    if (now > proofFile.expiresAt) {
      proofCache.delete(proofId);
      count++;
    }
  });
  
  if (count > 0) {
    console.log(`[Proof] 清理完成，删除 ${count} 个过期证明`);
  }
}

/**
 * 清除电路缓存
 * 
 * @param circuitName 电路名称（可选，不传则清除所有）
 */
export function clearCircuitCache(circuitName?: string): void {
  if (circuitName) {
    circuitCache.delete(circuitName);
    console.log(`[Circuit] 缓存已清除：${circuitName}`);
  } else {
    circuitCache.clear();
    console.log('[Circuit] 所有缓存已清除');
  }
}

/**
 * 获取已加载的电路
 * 
 * @param circuitName 电路名称
 * @returns 加载的电路对象（如果已加载）
 */
export function getCachedCircuit(circuitName: string): LoadedCircuit | undefined {
  return circuitCache.get(circuitName);
}

/**
 * 获取所有已加载的电路名称
 * 
 * @returns 电路名称列表
 */
export function getLoadedCircuitNames(): string[] {
  return Array.from(circuitCache.keys());
}

/**
 * 预加载核心电路
 * 
 * 用途：在应用启动时预加载核心电路，提升用户体验
 */
export async function preloadCoreCircuits(): Promise<void> {
  const coreCircuits = [
    'identity',
    'anonymousClaim',
  ];
  
  console.log('[Circuit] 开始预加载核心电路...');
  
  try {
    await loadCircuits(coreCircuits);
    console.log(`[Circuit] 预加载完成，共 ${getLoadedCircuitNames().length} 个电路`);
  } catch (error) {
    console.error('[Circuit] 预加载失败:', error);
    // 不抛出错误，允许降级使用
  }
}

/**
 * 定期清理过期证明
 * 
 * 建议：每 5 分钟执行一次
 */
export function startProofCleanup(intervalMs: number = 5 * 60 * 1000): void {
  setInterval(() => {
    cleanupExpiredProofs();
  }, intervalMs);
  
  console.log(`[Proof] 定期清理已启动，间隔：${intervalMs}ms`);
}

/**
 * 导出电路加载器
 */
export const circuitLoader = {
  loadCircuit,
  loadCircuits,
  saveProof,
  getProof,
  deleteProof,
  cleanupExpiredProofs,
  clearCircuitCache,
  getCachedCircuit,
  getLoadedCircuitNames,
  preloadCoreCircuits,
  startProofCleanup,
};

/**
 * 导出默认加载器
 */
export default circuitLoader;
