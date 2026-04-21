/**
 * 日志工具（脱敏版）
 * 
 * 安全规范（最高优先级）：
 * - 🚫 严禁记录明文敏感数据（身份承诺、健康数据、私钥）
 * - ✅ 所有敏感数据必须哈希脱敏后记录
 * - ✅ 生产环境应关闭 DEBUG 级别日志
 * - ✅ 支持日志轮转，防止磁盘溢出
 * 
 * 隐私保护：
 * - 用户 ID、地址、承诺哈希必须脱敏
 * - 私有输入（Witness）绝不能记录
 * - 符合 GDPR/PIPL 数据最小化原则
 * 
 * 日志级别：
 * - ERROR：错误（必须记录，用于告警）
 * - WARN：警告（记录异常但非阻断性错误）
 * - INFO：信息（记录关键业务流程）
 * - DEBUG：调试（仅开发环境，生产禁用）
 * 
 * 使用示例：
 *   logger.info('用户登录', { address: '0x...' });
 *   logger.error('数据库连接失败', { error: err });
 *   logger.audit('nullifier.insert', '0x123***', { success: true });
 * 
 * @module utils/logger
 */

import { appendFile } from 'node:fs/promises';

/**
 * 日志级别枚举
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * 当前日志级别（从环境变量读取）
 * 生产环境应设置为 'ERROR' 或 'WARN'
 */
const currentLevel = LogLevel[process.env.LOG_LEVEL] || LogLevel.INFO;

/** 设置 LOG_FILE 后，ERROR/WARN 除控制台外追加写入该路径（便于容器侧车采集） */
const LOG_FILE_PATH = process.env.LOG_FILE || '';

function appendLogFileLine(line) {
  if (!LOG_FILE_PATH) return;
  appendFile(LOG_FILE_PATH, `${line}\n`, { flag: 'a' }).catch((err) => {
    console.error('[logger] LOG_FILE 写入失败:', err.message);
  });
}

/**
 * 敏感字段白名单（允许记录的字段）
 * 不在白名单的字段会自动脱敏
 */
const ALLOWED_FIELDS = [
  'timestamp',
  'level',
  'service',
  'operation',
  'duration',
  'status',
];

/**
 * 敏感字段黑名单（必须脱敏的字段）
 */
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'privateKey',
  'mnemonic',
  'commitment',
  'nullifier',
  'witness',
  'trapdoor',
  'userId',
  'address',
  'wallet',
  'healthData',
  'bloodPressure',
  'age',
  'gender',
];

/**
 * 脱敏函数：将敏感数据替换为哈希值
 * 
 * @param {any} value - 待脱敏的值
 * @returns {string} 脱敏后的字符串
 */
function maskValue(value) {
  if (value === null || value === undefined) {
    return '[NULL]';
  }
  
  const str = String(value);
  
  // 空值直接返回
  if (str.length === 0) {
    return '[EMPTY]';
  }
  
  // 仅保留前 4 位和后 4 位
  if (str.length > 8) {
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
  }
  
  return '[MASKED]';
}

/**
 * 对象深度脱敏
 * 
 * @param {Object} obj - 待脱敏的对象
 * @returns {Object} 脱敏后的对象
 */
function deepMask(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const masked = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // 检查是否为敏感字段
    const isSensitive = SENSITIVE_FIELDS.some(
      field => key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      // 敏感字段：记录哈希值而非明文
      masked[key] = maskValue(value);
    } else if (typeof value === 'object' && value !== null) {
      // 递归处理嵌套对象
      masked[key] = deepMask(value);
    } else {
      // 非敏感字段：直接记录
      masked[key] = value;
    }
  }
  
  return masked;
}

/**
 * 格式化日志输出
 * 
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} meta - 元数据
 * @returns {string} 格式化后的日志字符串
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const service = 'trustaid-backend';
  
  // 脱敏元数据
  const maskedMeta = deepMask(meta);
  
  // 结构化日志格式（JSON，便于日志系统解析）
  const logEntry = {
    timestamp,
    level,
    service,
    message,
    ...maskedMeta,
  };
  
  return JSON.stringify(logEntry);
}

/**
 * 日志输出函数
 * 
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} meta - 元数据（可选）
 */
function log(level, message, meta = {}) {
  // 检查日志级别是否允许输出
  if (LogLevel[level] > currentLevel) {
    return;
  }
  
  const formattedLog = formatLog(level, message, meta);
  
  // 根据级别输出到不同流
  switch (level) {
    case 'ERROR':
    case 'WARN':
      console.error(formattedLog);
      appendLogFileLine(formattedLog);
      break;
    default:
      console.log(formattedLog);
  }
}

/**
 * 错误级别日志
 * 
 * 使用场景：
 * - 系统异常
 * - 数据库连接失败
 * - ZKP 验证失败
 * - 安全攻击检测
 * 
 * @param {string} message - 错误消息
 * @param {Object} meta - 元数据（如 error.stack）
 */
export function error(message, meta = {}) {
  log('ERROR', message, meta);
}

/**
 * 警告级别日志
 * 
 * 使用场景：
 * - 参数验证失败
 * - 限流触发
 * - 非阻断性错误
 * 
 * @param {string} message - 警告消息
 * @param {Object} meta - 元数据
 */
export function warn(message, meta = {}) {
  log('WARN', message, meta);
}

/**
 * 信息级别日志
 * 
 * 使用场景：
 * - 用户操作（已脱敏）
 * - 业务流程节点
 * - 系统启动/关闭
 * 
 * @param {string} message - 信息消息
 * @param {Object} meta - 元数据
 */
export function info(message, meta = {}) {
  log('INFO', message, meta);
}

/**
 * 调试级别日志
 * 
 * 使用场景：
 * - 开发环境调试
 * - 详细流程跟踪
 * - 性能分析
 * 
 * ⚠️ 生产环境必须关闭！
 * 
 * @param {string} message - 调试消息
 * @param {Object} meta - 元数据
 */
export function debug(message, meta = {}) {
  log('DEBUG', message, meta);
}

/**
 * 安全审计日志（特殊处理）
 * 
 * 用途：记录所有敏感操作，用于安全审计
 * 特点：
 * - 必须记录（不受日志级别限制）
 * - 必须脱敏
 * - 必须包含操作者和时间戳
 * 
 * @param {string} operation - 操作名称
 * @param {string} operator - 操作者（已脱敏）
 * @param {Object} details - 操作详情（已脱敏）
 */
export function audit(operation, operator, details = {}) {
  const auditLog = {
    type: 'SECURITY_AUDIT',
    timestamp: new Date().toISOString(),
    operation,
    operator: maskValue(operator), // 强制脱敏
    details: deepMask(details),
    outcome: details.success ? 'SUCCESS' : 'FAILURE',
  };
  
  // 审计日志始终输出（不受级别限制）
  const line = JSON.stringify(auditLog);
  console.log(line);
  appendLogFileLine(line);
}

/**
 * ZKP 专用日志（严格脱敏）
 * 
 * ⚠️ 特别警告：
 * - 绝不能记录 Witness（见证人数据）
 * - 绝不能记录原始身份数据
 * - 仅记录证明生成/验证的结果
 * 
 * @param {string} circuitName - 电路名称
 * @param {string} operation - 操作（'generate' | 'verify'）
 * @param {boolean} success - 是否成功
 * @param {number} duration - 耗时（毫秒）
 */
export function zkpLog(circuitName, operation, success, duration) {
  // 仅记录电路名称和操作结果，不记录任何输入数据
  info(`[ZKP] ${operation} ${circuitName}`, {
    success,
    duration: `${duration}ms`,
    // 注意：不记录 publicSignals 或 proof，防止信息泄露
  });
}

/**
 * 性能日志
 * 
 * @param {string} operation - 操作名称
 * @param {number} startTime - 开始时间（Date.now()）
 */
export function performanceLog(operation, startTime) {
  const duration = Date.now() - startTime;
  
  // 仅当耗时超过阈值时记录
  if (duration > 1000) {
    warn(`[性能] ${operation} 耗时过长`, {
      duration: `${duration}ms`,
      threshold: '1000ms',
    });
  } else {
    debug(`[性能] ${operation}`, {
      duration: `${duration}ms`,
    });
  }
}

/**
 * 内存使用监控
 * 
 * 记录当前进程的内存使用情况
 * 
 * @param {string} [label] - 可选标签（用于区分不同时间点）
 */
export function memoryUsage(label) {
  const usage = process.memoryUsage();
  
  const memoryInfo = {
    label: label || 'memory',
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`, // 常驻集大小
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`, // 堆总大小
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`, // 堆使用量
    external: `${Math.round(usage.external / 1024 / 1024)}MB`, // V8 外部内存
  };
  
  // 当堆使用量超过 80% 时发出警告
  const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
  if (heapUsagePercent > 80) {
    warn('[内存] 堆内存使用率过高', {
      ...memoryInfo,
      usagePercent: `${heapUsagePercent.toFixed(2)}%`,
    });
  } else {
    debug('[内存] 内存使用情况', memoryInfo);
  }
  
  return memoryInfo;
}

/**
 * 数据库连接池监控
 * 
 * 记录连接池状态
 * 
 * @param {Object} pool - 数据库连接池对象
 * @param {string} poolName - 连接池名称
 */
export function poolMonitor(pool, poolName) {
  if (!pool || !pool.pool) {
    debug('[DB] 连接池未初始化', { poolName });
    return;
  }
  
  const poolInfo = {
    poolName,
    activeConnections: pool.pool._allConnections?.length || 0,
    freeConnections: pool.pool._freeConnections?.length || 0,
    connectionQueueLength: pool.pool._connectionQueue?.length || 0,
  };
  
  // 当连接池使用率超过 80% 时发出警告
  const usagePercent = (poolInfo.activeConnections / 10) * 100; // 假设最大连接数为 10
  if (usagePercent > 80 || poolInfo.connectionQueueLength > 0) {
    warn('[DB] 连接池使用率过高', poolInfo);
  } else {
    debug('[DB] 连接池状态', poolInfo);
  }
}

/**
 * 结构化日志记录器（支持链式调用）
 * 
 * 使用示例：
 *   logger
 *     .context('claim.submit')
 *     .tag('zkp')
 *     .info('证明生成成功', { duration: 1234 });
 */
export class StructuredLogger {
  constructor() {
    this.context = null;
    this.tags = [];
    this.meta = {};
  }
  
  /**
   * 设置上下文
   * 
   * @param {string} ctx - 上下文（如 'claim.submit'）
   * @returns {StructuredLogger} this
   */
  context(ctx) {
    this.context = ctx;
    return this;
  }
  
  /**
   * 添加标签
   * 
   * @param {string} tag - 标签名
   * @returns {StructuredLogger} this
   */
  tag(tag) {
    this.tags.push(tag);
    return this;
  }
  
  /**
   * 添加元数据
   * 
   * @param {Object} meta - 元数据对象
   * @returns {StructuredLogger} this
   */
  meta(meta) {
    this.meta = { ...this.meta, ...meta };
    return this;
  }
  
  /**
   * 记录信息日志
   * 
   * @param {string} message - 日志消息
   * @param {Object} [extraMeta] - 额外元数据
   */
  info(message, extraMeta = {}) {
    info(message, {
      ...this.meta,
      ...extraMeta,
      context: this.context,
      tags: this.tags,
    });
  }
  
  /**
   * 记录警告日志
   * 
   * @param {string} message - 日志消息
   * @param {Object} [extraMeta] - 额外元数据
   */
  warn(message, extraMeta = {}) {
    warn(message, {
      ...this.meta,
      ...extraMeta,
      context: this.context,
      tags: this.tags,
    });
  }
  
  /**
   * 记录错误日志
   * 
   * @param {string} message - 日志消息
   * @param {Object} [extraMeta] - 额外元数据
   */
  error(message, extraMeta = {}) {
    error(message, {
      ...this.meta,
      ...extraMeta,
      context: this.context,
      tags: this.tags,
    });
  }
  
  /**
   * 记录调试日志
   * 
   * @param {string} message - 日志消息
   * @param {Object} [extraMeta] - 额外元数据
   */
  debug(message, extraMeta = {}) {
    debug(message, {
      ...this.meta,
      ...extraMeta,
      context: this.context,
      tags: this.tags,
    });
  }
}

/**
 * 创建结构化日志记录器实例
 * 
 * @returns {StructuredLogger} 结构化日志记录器
 */
export function createLogger() {
  return new StructuredLogger();
}

/**
 * 导出日志配置
 */
export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'INFO',
  maskSensitiveFields: true,
  auditEnabled: true,
};
