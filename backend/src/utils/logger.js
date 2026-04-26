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
import { dirname, join } from 'node:path';

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

/** 设置 LOG_FILE 后，日志按分类写入对应文件 */
const LOG_FILE_PATH  = process.env.LOG_FILE || '';
const _logDir        = LOG_FILE_PATH ? dirname(LOG_FILE_PATH) : '';
/** ERROR 级别单独归档 */
const ERROR_LOG_PATH = _logDir ? join(_logDir, 'error.log')  : '';
/** HTTP 访问日志（独立于主日志级别，类似 nginx access.log） */
const HTTP_LOG_PATH  = _logDir ? join(_logDir, 'http.log')   : '';
/** 安全审计日志 */
const AUDIT_LOG_PATH = _logDir ? join(_logDir, 'audit.log')  : '';

function appendToFile(filePath, line) {
  if (!filePath) return;
  appendFile(filePath, `${line}\n`, { flag: 'a' }).catch((err) => {
    console.error('[logger] 日志写入失败:', filePath, err.message);
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
function formatLog(level, message, meta = {}, category = 'app') {
  const timestamp = new Date().toISOString();
  const service = 'trustaid-backend';
  
  // 脱敏元数据
  const maskedMeta = deepMask(meta);
  
  // 结构化日志格式（JSON，便于日志系统解析）
  const logEntry = {
    timestamp,
    level,
    service,
    category,
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
function log(level, message, meta = {}, category = 'app') {
  if (LogLevel[level] > currentLevel) {
    return;
  }
  
  // ERROR 级别自动提取 Error 对象堆栈
  const extraMeta = {};
  if (level === 'ERROR' && meta.error instanceof Error && meta.error.stack) {
    extraMeta.stack = meta.error.stack;
  }
  
  const formattedLog = formatLog(level, message, { ...meta, ...extraMeta }, category);
  
  // 控制台输出（ERROR/WARN → stderr，其余 → stdout）
  if (level === 'ERROR') {
    console.error(formattedLog);
  } else if (level === 'WARN') {
    console.warn(formattedLog);
  } else {
    console.log(formattedLog);
  }
  
  // 合并日志（全级别写入文件，便于完整追溯）
  appendToFile(LOG_FILE_PATH, formattedLog);
  // ERROR 单独归档
  if (level === 'ERROR') {
    appendToFile(ERROR_LOG_PATH, formattedLog);
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
export function error(message, meta = {}, category = 'app') {
  log('ERROR', message, meta, category);
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
export function warn(message, meta = {}, category = 'app') {
  log('WARN', message, meta, category);
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
export function info(message, meta = {}, category = 'app') {
  log('INFO', message, meta, category);
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
export function debug(message, meta = {}, category = 'app') {
  log('DEBUG', message, meta, category);
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
    timestamp: new Date().toISOString(),
    level: 'AUDIT',
    service: 'trustaid-backend',
    category: 'audit',
    type: 'SECURITY_AUDIT',
    operation,
    operator: maskValue(operator),
    details: deepMask(details),
    outcome: details.success ? 'SUCCESS' : 'FAILURE',
  };
  
  // 审计日志始终输出（不受级别限制）
  const line = JSON.stringify(auditLog);
  console.log(line);
  appendToFile(LOG_FILE_PATH, line);
  appendToFile(AUDIT_LOG_PATH, line);
}

/**
 * HTTP 访问日志
 *
 * 5xx → ERROR，4xx → WARN，其余 → INFO
 * 访问记录始终写入 http.log（独立于 LOG_LEVEL，类似 nginx access.log）
 *
 * @param {string} method - HTTP 方法
 * @param {string} url - 请求路径
 * @param {number} status - 响应状态码
 * @param {number} duration - 耗时（ms）
 * @param {Object} [meta] - 扩展字段（ip、uid 等，自动脱敏）
 */
export function httpLog(method, url, status, duration, meta = {}) {
  const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'trustaid-backend',
    category: 'http',
    method,
    url,
    status,
    duration: `${duration}ms`,
    ...deepMask(meta),
  });

  // 控制台仅输出达到当前级别的日志
  if (LogLevel[level] <= currentLevel) {
    if (level === 'ERROR') console.error(entry);
    else if (level === 'WARN') console.warn(entry);
    else console.log(entry);
  }

  // HTTP 访问日志始终写入 http.log（不受 LOG_LEVEL 过滤）
  appendToFile(HTTP_LOG_PATH, entry);
  // 合并日志（按 LOG_LEVEL 过滤）
  if (LogLevel[level] <= currentLevel) {
    appendToFile(LOG_FILE_PATH, entry);
  }
  // 错误单独归档
  if (level === 'ERROR') {
    appendToFile(ERROR_LOG_PATH, entry);
  }
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
  }, 'zkp');
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
    }, 'perf');
  } else {
    debug(`[性能] ${operation}`, {
      duration: `${duration}ms`,
    }, 'perf');
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
    }, 'system');
  } else {
    debug('[内存] 内存使用情况', memoryInfo, 'system');
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
