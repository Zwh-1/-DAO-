/**
 * 合约 ABI 加载器
 * 
 * 功能：
 * - 自动加载合约 ABI 文件
 * - 支持 TypeScript 类型
 * - 提供合约调用封装
 * 
 * 安全规范：
 * - ABI 文件为公开数据，可安全提交至版本控制
 * - 不包含私钥或敏感信息
 */

import type { Abi } from 'viem';

/**
 * ABI 文件类型定义
 */
export interface AbiFile {
  abi: Abi;
  bytecode?: string;
  deployedBytecode?: string;
  sourceName?: string;
  contractName: string;
}

/**
 * 合约 ABI 缓存
 */
const abiCache = new Map<string, AbiFile>();

/**
 * 加载合约 ABI
 * 
 * @param contractName 合约名称
 * @returns ABI 文件对象
 */
export async function loadAbi(contractName: string): Promise<AbiFile> {
  // 检查缓存
  if (abiCache.has(contractName)) {
    console.log(`[ABI] 从缓存加载：${contractName}`);
    return abiCache.get(contractName)!;
  }
  
  try {
    console.log(`[ABI] 开始加载：${contractName}`);
    
    // 动态导入 ABI 文件
    const abiModule = await import(`@/lib/contracts/abis/${contractName}.json`);
    
    const abiFile: AbiFile = {
      abi: abiModule.abi || abiModule.default,
      bytecode: abiModule.bytecode,
      deployedBytecode: abiModule.deployedBytecode,
      sourceName: abiModule.sourceName,
      contractName,
    };
    
    // 缓存
    abiCache.set(contractName, abiFile);
    
    console.log(`[ABI] 加载成功：${contractName}`);
    
    return abiFile;
  } catch (error) {
    console.error(`[ABI] 加载失败：${contractName}`, error);
    throw new Error(`无法加载合约 ${contractName} 的 ABI: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 批量加载 ABI
 * 
 * @param contractNames 合约名称列表
 * @returns ABI 文件映射
 */
export async function loadAbis(contractNames: string[]): Promise<Record<string, AbiFile>> {
  const results: Record<string, AbiFile> = {};
  
  await Promise.all(
    contractNames.map(async (name) => {
      try {
        results[name] = await loadAbi(name);
      } catch (error) {
        console.error(`[ABI] 批量加载失败：${name}`, error);
        // 继续加载其他合约
      }
    })
  );
  
  return results;
}

/**
 * 清除 ABI 缓存
 * 
 * @param contractName 合约名称（可选，不传则清除所有）
 */
export function clearAbiCache(contractName?: string): void {
  if (contractName) {
    abiCache.delete(contractName);
    console.log(`[ABI] 缓存已清除：${contractName}`);
  } else {
    abiCache.clear();
    console.log('[ABI] 所有缓存已清除');
  }
}

/**
 * 获取已加载的 ABI
 * 
 * @param contractName 合约名称
 * @returns ABI 文件对象（如果已加载）
 */
export function getCachedAbi(contractName: string): AbiFile | undefined {
  return abiCache.get(contractName);
}

/**
 * 获取所有已加载的 ABI 名称
 * 
 * @returns 合约名称列表
 */
export function getLoadedAbiNames(): string[] {
  return Array.from(abiCache.keys());
}

/**
 * 预加载常用 ABI
 * 
 * 用途：在应用启动时预加载核心合约 ABI，提升用户体验
 */
export async function preloadCoreAbis(): Promise<void> {
  const coreContracts = [
    'ClaimVault',
    'ClaimVaultZK',
    'IdentityRegistry',
    'SBT',
    'AnonymousClaim',
  ];
  
  console.log('[ABI] 开始预加载核心合约...');
  
  try {
    await loadAbis(coreContracts);
    console.log(`[ABI] 预加载完成，共 ${getLoadedAbiNames().length} 个合约`);
  } catch (error) {
    console.error('[ABI] 预加载失败:', error);
    // 不抛出错误，允许降级使用
  }
}

/**
 * 导出 ABI 加载器
 */
export const abiLoader = {
  loadAbi,
  loadAbis,
  clearAbiCache,
  getCachedAbi,
  getLoadedAbiNames,
  preloadCoreAbis,
};

/**
 * 导出默认加载器
 */
export default abiLoader;
