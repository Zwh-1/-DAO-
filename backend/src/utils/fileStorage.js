/**
 * 文件存储工具
 * 
 * 职责：
 * - 提供统一的文件读写接口
 * - 自动创建目录（如果不存在）
 * - 设置文件权限（敏感文件 600，公开文件 644）
 * - 生成唯一的文件标识符（防冲突）
 * 
 * 安全规范：
 * - 禁止路径遍历攻击（验证文件路径）
 * - 敏感文件加密存储（可选）
 * - 日志脱敏（不记录完整文件内容）
 */

import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir,
  access,
  chmod,
  unlink,
  readdir,
  stat,
} from 'node:fs/promises';
import { join, basename, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getStoragePath, getProofExpiration, filePermissions } from '../config/storage.js';
import { audit } from './logger.js';

/**
 * 验证文件路径安全性（防止路径遍历攻击）
 * 
 * @param {string} filePath - 文件路径
 * @param {string} baseDir - 基础目录
 * @returns {boolean} 是否安全
 * 
 * 安全检查：
 * - 路径必须以 baseDir 开头
 * - 禁止包含 .. 父目录引用
 */
function isPathSafe(filePath, baseDir) {
  const normalizedPath = normalize(filePath);
  const normalizedBase = normalize(baseDir);
  
  // 禁止父目录引用
  if (normalizedPath.includes('..')) {
    return false;
  }
  
  // 必须在基础目录内
  return normalizedPath.startsWith(normalizedBase);
}

/**
 * 确保目录存在（不存在则创建）
 * 
 * @param {string} dirPath - 目录路径
 * @param {number} mode - 权限模式（可选）
 */
async function ensureDirExists(dirPath, mode = 0o755) {
  try {
    await access(dirPath);
  } catch (error) {
    // 目录不存在，创建
    await mkdir(dirPath, { recursive: true, mode });
  }
}

/**
 * 生成唯一的文件标识符
 * 
 * @param {string} prefix - 前缀（可选）
 * @param {string} extension - 文件扩展名
 * @returns {string} 唯一文件名
 * 
 * 生成规则：
 * - 时间戳 + UUID（防冲突）
 * - 可选前缀（便于分类）
 */
export function generateUniqueFileName(prefix = '', extension = '.json') {
  const timestamp = Date.now();
  const uuid = randomUUID().replace(/-/g, '').slice(0, 8);
  
  if (prefix) {
    return `${prefix}-${timestamp}-${uuid}${extension}`;
  }
  
  return `${timestamp}-${uuid}${extension}`;
}

/**
 * 保存 ABI 文件
 * 
 * @param {string} filename - 文件名
 * @param {Object} abiData - ABI 数据
 * @returns {string} 保存的文件路径
 */
export async function saveABI(filename, abiData) {
  const abisDir = getStoragePath('abis');
  const filePath = join(abisDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, abisDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  // 确保目录存在
  await ensureDirExists(abisDir);
  
  // 写入文件（公开文件权限 644）
  await fsWriteFile(filePath, JSON.stringify(abiData, null, 2), {
    mode: filePermissions.public,
    encoding: 'utf-8',
  });
  
  // 审计日志（脱敏）
  audit('ABI_SAVED', {
    filename: basename(filename),
    size: JSON.stringify(abiData).length,
  });
  
  return filePath;
}

/**
 * 加载 ABI 文件
 * 
 * @param {string} filename - 文件名
 * @returns {Promise<Object>} ABI 数据
 */
export async function loadABI(filename) {
  const abisDir = getStoragePath('abis');
  const filePath = join(abisDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, abisDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  try {
    const content = await fsReadFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`[文件存储] 加载 ABI 失败：${filename} - ${error.message}`);
  }
}

/**
 * 保存证明文件（敏感文件）
 * 
 * @param {string} filename - 文件名
 * @param {Object} proofData - 证明数据
 * @param {Object} options - 选项
 * @param {boolean} options.sensitive - 是否敏感文件（默认 true）
 * @param {string} options.subDir - 子目录（可选）
 * @returns {string} 保存的文件路径
 * 
 * 安全规范：
 * - 默认设置为敏感文件（权限 600）
 * - 支持子目录隔离（如按用户、按环境）
 */
export async function saveProof(filename, proofData, options = {}) {
  const { sensitive = true, subDir = null } = options;
  
  const proofsDir = getStoragePath('proofs', subDir);
  const filePath = join(proofsDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, proofsDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  // 确保目录存在
  await ensureDirExists(proofsDir, sensitive ? 0o700 : 0o755);
  
  // 写入文件（敏感文件权限 600）
  await fsWriteFile(filePath, JSON.stringify(proofData), {
    mode: sensitive ? filePermissions.sensitive : filePermissions.public,
    encoding: 'utf-8',
  });
  
  // 审计日志（脱敏，不记录证明内容）
  audit('PROOF_SAVED', {
    filename: basename(filename),
    subDir: subDir || 'root',
    size: JSON.stringify(proofData).length,
    sensitive,
  });
  
  return filePath;
}

/**
 * 加载证明文件
 * 
 * @param {string} filename - 文件名
 * @param {string} subDir - 子目录（可选）
 * @returns {Promise<Object>} 证明数据
 */
export async function loadProof(filename, subDir = null) {
  const proofsDir = getStoragePath('proofs', subDir);
  const filePath = join(proofsDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, proofsDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  try {
    const content = await fsReadFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`[文件存储] 加载证明失败：${filename} - ${error.message}`);
  }
}

/**
 * 删除证明文件
 * 
 * @param {string} filename - 文件名
 * @param {string} subDir - 子目录（可选）
 */
export async function deleteProof(filename, subDir = null) {
  const proofsDir = getStoragePath('proofs', subDir);
  const filePath = join(proofsDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, proofsDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  try {
    await unlink(filePath);
    
    // 审计日志
    audit('PROOF_DELETED', {
      filename: basename(filename),
      subDir: subDir || 'root',
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * 保存公开输入数据
 * 
 * @param {string} filename - 文件名
 * @param {Array<string>} publicInputs - 公开输入数组
 * @param {string} subDir - 子目录（可选）
 * @returns {string} 保存的文件路径
 */
export async function savePublicInput(filename, publicInputs, subDir = null) {
  const publicInputsDir = getStoragePath('publicInputs', subDir);
  const filePath = join(publicInputsDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, publicInputsDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  // 确保目录存在
  await ensureDirExists(publicInputsDir);
  
  // 写入文件
  await fsWriteFile(filePath, JSON.stringify(publicInputs), {
    mode: filePermissions.public,
    encoding: 'utf-8',
  });
  
  // 审计日志（脱敏）
  audit('PUBLIC_INPUT_SAVED', {
    filename: basename(filename),
    inputCount: publicInputs.length,
  });
  
  return filePath;
}

/**
 * 加载公开输入数据
 * 
 * @param {string} filename - 文件名
 * @param {string} subDir - 子目录（可选）
 * @returns {Promise<Array<string>>} 公开输入数据
 */
export async function loadPublicInput(filename, subDir = null) {
  const publicInputsDir = getStoragePath('publicInputs', subDir);
  const filePath = join(publicInputsDir, filename);
  
  // 路径安全检查
  if (!isPathSafe(filePath, publicInputsDir)) {
    throw new Error('[文件存储] 路径遍历攻击检测：禁止访问父目录');
  }
  
  try {
    const content = await fsReadFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`[文件存储] 加载公开输入失败：${filename} - ${error.message}`);
  }
}

/**
 * 列出目录中的所有文件
 * 
 * @param {string} type - 存储类型 ('abis' | 'proofs' | 'publicInputs')
 * @param {string} subDir - 子目录（可选）
 * @returns {Promise<Array<string>>} 文件名列表
 */
export async function listFiles(type, subDir = null) {
  const dirPath = getStoragePath(type, subDir);
  
  try {
    const files = await readdir(dirPath);
    return files;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // 目录不存在，返回空数组
    }
    throw error;
  }
}

/**
 * 获取文件信息（大小、创建时间等）
 * 
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 文件信息
 */
export async function getFileInfo(filePath) {
  const stats = await stat(filePath);
  
  return {
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
  };
}

/**
 * 清理过期文件
 * 
 * @param {string} type - 存储类型 ('proofs' | 'publicInputs')
 * @param {number} maxAge - 最大保留时间（毫秒）
 * @returns {Promise<Object>} 清理统计
 */
export async function cleanupExpiredFiles(type, maxAge) {
  const dirPath = getStoragePath(type);
  const files = await listFiles(type);
  const now = Date.now();
  
  let deletedCount = 0;
  let totalSize = 0;
  
  for (const file of files) {
    const filePath = join(dirPath, file);
    
    try {
      const stats = await stat(filePath);
      const fileAge = now - stats.mtime.getTime();
      
      if (fileAge > maxAge) {
        await unlink(filePath);
        deletedCount++;
        totalSize += stats.size;
      }
    } catch (error) {
      // 跳过无法访问的文件
      continue;
    }
  }
  
  // 审计日志
  audit('FILES_CLEANUP', {
    type,
    deletedCount,
    totalSize,
  });
  
  return { deletedCount, totalSize };
}

/**
 * 导出所有工具函数
 */
export const fileStorage = {
  generateUniqueFileName,
  saveABI,
  loadABI,
  saveProof,
  loadProof,
  deleteProof,
  savePublicInput,
  loadPublicInput,
  listFiles,
  getFileInfo,
  cleanupExpiredFiles,
};
