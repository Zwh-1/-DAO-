/**
 * 数据库配置模块
 * 
 * 职责：
 * - 管理数据库连接字符串
 * - 配置连接池参数
 * - 支持多环境配置
 * 
 * 安全规范：
 * - 连接字符串必须通过环境变量配置
 * - 禁止硬编码数据库密码
 * - 生产环境应使用 SSL 连接
 * 
 * 环境变量：
 * - DATABASE_URL：MySQL 连接字符串（mysql://，由 mysql2 解析）
 * - DB_POOL_SIZE：连接池大小（默认 10）
 * - DB_IDLE_TIMEOUT：空闲超时（毫秒，默认 30000）
 */

import { config as appConfig } from '../config.js';

/**
 * 数据库连接配置
 *
 * 连接字符串格式（与 src/db/pool.js 一致）：
 * mysql://user:password@host:port/database
 */
export const databaseConfig = {
  // 连接字符串（从环境变量读取）
  connectionString: process.env.DATABASE_URL || appConfig.databaseUrl,
  
  // 连接池配置
  max: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 5000,
  
  // SSL 配置（生产环境必需）
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } // 允许自签名证书
    : false,
};

// 验证数据库配置是否完整
export function validateDatabaseConfig() {
  if (!databaseConfig.connectionString) {
    console.error('[数据库配置] 错误：DATABASE_URL 未配置');
    return false;
  }
  
  // 验证连接字符串格式（mysql2 URI；含 user:password@host:port/db）
  const urlPattern = /^mysql:\/\/.+@.+\/.+/;
  if (!urlPattern.test(databaseConfig.connectionString)) {
    console.error('[数据库配置] 错误：DATABASE_URL 须为 mysql://user:pass@host:port/db 形式');
    return false;
  }
  
  // 生产环境检查 SSL
  if (process.env.NODE_ENV === 'production' && !databaseConfig.ssl) {
    console.warn('[数据库配置] 警告：生产环境应启用 SSL 连接');
  }
  
  return true;
}

// 获取连接池风格配置（供健康检查等使用；实际连接见 src/db/pool.js）
export function getPoolConfig() {
  return {
    connectionString: databaseConfig.connectionString,
    max: databaseConfig.max,
    idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
    ssl: databaseConfig.ssl,
  };
}

/**
 * 数据库配置健康检查
 * 
 * @returns {Object} 健康检查结果
 * 
 * 检查项：
 * - 连接字符串是否配置
 * - 连接池参数是否合理
 * - SSL 是否启用（生产环境）
 */
export function healthCheck() {
  const issues = [];
  
  if (!databaseConfig.connectionString) {
    issues.push('DATABASE_URL 未配置');
  }
  
  if (databaseConfig.max < 1 || databaseConfig.max > 100) {
    issues.push(`连接池大小不合理：${databaseConfig.max}`);
  }
  
  if (process.env.NODE_ENV === 'production' && !databaseConfig.ssl) {
    issues.push('生产环境未启用 SSL');
  }
  
  return {
    healthy: issues.length === 0,
    issues,
    config: {
      max: databaseConfig.max,
      ssl: databaseConfig.ssl,
      environment: process.env.NODE_ENV || 'development',
    },
  };
}
