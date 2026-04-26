/**
 * 证明文件自动清理服务
 * 
 * 职责：
 * - 定期清理过期的证明文件
 * - 防止磁盘空间溢出
 * - 保留审计日志
 * 
 * 清理策略：
 * - 开发环境：保留 24 小时
 * - 测试环境：保留 1 小时
 * - 生产环境：验证后立即删除（10 分钟宽限期）
 */

import { cleanupExpiredFiles } from '../../utils/fileStorage.js';
import { getProofExpiration } from '../../config/storage.js';
import { audit, error as logError, info as logInfo } from '../../utils/logger.js';

// 定时任务 ID（用于取消）
let cleanupIntervalId = null;

/**
 * 获取清理间隔时间（毫秒）
 * 
 * 设计理由：
 * - 开发环境：5 分钟（便于调试）
 * - 测试环境：1 分钟（快速清理）
 * - 生产环境：10 分钟（平衡性能与存储）
 */
function getCleanupInterval(env = process.env.NODE_ENV) {
  const intervalMap = {
    development: 5 * 60 * 1000,   // 5 分钟
    test: 1 * 60 * 1000,          // 1 分钟
    production: 10 * 60 * 1000,   // 10 分钟
  };
  
  return intervalMap[env] || intervalMap.development;
}

/**
 * 执行过期证明清理
 * 
 * @returns {Promise<Object>} 清理统计
 */
export async function cleanupExpiredProofs() {
  try {
    const maxAge = getProofExpiration();
    
    logInfo(`[清理任务] 开始清理过期证明（最大保留时间：${maxAge / 1000}秒）`);
    
    // 清理 proofs 目录
    const proofsResult = await cleanupExpiredFiles('proofs', maxAge);
    
    // 清理 publicInputs 目录
    const publicInputsResult = await cleanupExpiredFiles('publicInputs', maxAge);
    
    // 审计日志
    audit('PROOF_CLEANUP_COMPLETED', {
      proofsDeleted: proofsResult.deletedCount,
      proofsSizeFreed: proofsResult.totalSize,
      publicInputsDeleted: publicInputsResult.deletedCount,
      publicInputsSizeFreed: publicInputsResult.totalSize,
    });
    
    logInfo(`[清理任务] 完成：删除 ${proofsResult.deletedCount + publicInputsResult.deletedCount} 个文件，释放 ${((proofsResult.totalSize + publicInputsResult.totalSize) / 1024).toFixed(2)} KB`);
    
    return {
      proofs: proofsResult,
      publicInputs: publicInputsResult,
      totalDeleted: proofsResult.deletedCount + publicInputsResult.deletedCount,
      totalSizeFreed: proofsResult.totalSize + publicInputsResult.totalSize,
    };
  } catch (err) {
    logError('[清理任务] 清理失败', err);
    
    audit('PROOF_CLEANUP_FAILED', {
      error: err.message,
    });
    
    throw err;
  }
}

/**
 * 启动定时清理任务
 * 
 * @param {number} interval - 清理间隔（毫秒，可选）
 * @returns {number} 定时器 ID
 */
export function startCleanupScheduler(interval = null) {
  // 如果已有定时器在运行，先停止
  if (cleanupIntervalId !== null) {
    stopCleanupScheduler();
  }
  
  const cleanupInterval = interval || getCleanupInterval();
  
  logInfo(`[清理任务] 启动定时清理（间隔：${cleanupInterval / 1000}秒）`);
  
  // 立即执行一次
  cleanupExpiredProofs();
  
  // 设置定时器
  cleanupIntervalId = setInterval(() => {
    cleanupExpiredProofs().catch((err) => {
      logError('[清理任务] 定时执行失败', err);
    });
  }, cleanupInterval);
  
  // 防止 Node.js 因定时器而保持进程运行（可选）
  if (cleanupIntervalId.unref) {
    cleanupIntervalId.unref();
  }
  
  return cleanupIntervalId;
}

/**
 * 停止定时清理任务
 */
export function stopCleanupScheduler() {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    
    logInfo('[清理任务] 定时清理已停止');
  }
}

/**
 * 获取定时任务状态
 * 
 * @returns {Object} 任务状态
 */
export function getSchedulerStatus() {
  return {
    isRunning: cleanupIntervalId !== null,
    intervalId: cleanupIntervalId,
    interval: getCleanupInterval(),
  };
}

/**
 * 导出所有服务函数
 */
export const proofCleanupService = {
  cleanupExpiredProofs,
  startCleanupScheduler,
  stopCleanupScheduler,
  getSchedulerStatus,
};
