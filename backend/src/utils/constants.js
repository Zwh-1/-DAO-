/**
 * 常量定义
 * 
 * 职责：
 * - 定义系统级常量
 * - 统一错误代码
 * - 定义配置参数
 * 
 * 使用规范：
 * - 所有常量使用大写字母
 * - 分类组织，便于查找
 * - 避免魔法数字
 */

/**
 * 错误代码
 */
export const ERROR_CODES = {
  // 通用错误 (1000-1999)
  INVALID_INPUT: 1001,
  MISSING_REQUIRED_FIELD: 1002,
  INTERNAL_ERROR: 1999,
  
  // 认证错误 (2000-2999)
  UNAUTHORIZED: 2001,
  INVALID_SIGNATURE: 2002,
  EXPIRED_NONCE: 2003,
  INVALID_JWT: 2004,
  ROLE_REQUIRED: 2005,
  
  // 身份相关错误 (3000-3999)
  IDENTITY_NOT_REGISTERED: 3001,
  IDENTITY_EXPIRED: 3002,
  IDENTITY_BANNED: 3003,
  DUPLICATE_NULLIFIER: 3004,
  INVALID_COMMITMENT: 3005,
  
  // 空投申领错误 (4000-4999)
  CLAIM_NOT_FOUND: 4001,
  CLAIM_ALREADY_SUBMITTED: 4002,
  CLAIM_VERIFICATION_FAILED: 4003,
  INSUFFICIENT_BALANCE: 4004,
  
  // 支付通道错误 (5000-5999)
  CHANNEL_NOT_FOUND: 5001,
  CHANNEL_CLOSED: 5002,
  CHANNEL_DISPUTED: 5003,
  INVALID_CHANNEL_STATE: 5004,
  
  // 声誉相关错误 (6000-6999)
  REPUTATION_NOT_FOUND: 6001,
  REPUTATION_VERIFICATION_FAILED: 6002,
  
  // ZKP 相关错误 (7000-7999)
  ZKP_VERIFICATION_FAILED: 7001,
  ZKP_INVALID_PROOF: 7002,
  ZKP_INVALID_PUBLIC_SIGNALS: 7003,
  ZKP_KEY_NOT_FOUND: 7004,
  
  // 数据库错误 (8000-8999)
  DATABASE_ERROR: 8001,
  DATABASE_CONNECTION_FAILED: 8002,
  DATABASE_QUERY_FAILED: 8003,
  
  // AI 服务错误 (9000-9999)
  AI_SERVICE_UNAVAILABLE: 9001,
  AI_SERVICE_TIMEOUT: 9002,
  AI_SERVICE_ERROR: 9999,
};

/**
 * 信任等级
 */
export const TRUST_LEVELS = {
  MIN: 0,
  MAX: 5,
  DEFAULT: 1,
};

/**
 * 角色定义
 */
export const ROLES = {
  USER: 'user',
  ORACLE: 'oracle',
  GUARDIAN: 'guardian',
  ADMIN: 'admin',
};

/**
 * 通道状态
 */
export const CHANNEL_STATES = {
  OPEN: 'open',
  CLOSED: 'closed',
  DISPUTED: 'disputed',
};

/**
 * 提案状态
 */
export const PROPOSAL_STATES = {
  ACTIVE: 'active',
  PASSED: 'passed',
  REJECTED: 'rejected',
  EXECUTED: 'executed',
};

/**
 * 时间常量（秒）
 */
export const TIME_CONSTANTS = {
  // 1 分钟
  ONE_MINUTE: 60,
  
  // 1 小时
  ONE_HOUR: 3600,
  
  // 1 天
  ONE_DAY: 86400,
  
  // 7 天
  ONE_WEEK: 604800,
  
  // 30 天
  ONE_MONTH: 2592000,
};

/**
 * 速率限制配置
 */
export const RATE_LIMITS = {
  // 默认限制
  DEFAULT: {
    max: 100,
    windowMs: 60000, // 1 分钟
  },
  
  // 严格限制（用于敏感操作）
  STRICT: {
    max: 10,
    windowMs: 60000, // 1 分钟
  },
  
  // 宽松限制（用于查询操作）
  LENIENT: {
    max: 500,
    windowMs: 60000, // 1 分钟
  },
};

/**
 * ZKP 电路配置
 */
export const ZKP_CONFIG = {
  // 抗女巫电路公开信号数量
  ANTI_SYBIL_PUBLIC_SIGNALS: 11,
  
  // 身份电路公开信号数量
  IDENTITY_PUBLIC_SIGNALS: 5,
  
  // Merkle 树深度
  MERKLE_TREE_DEPTH: 20,
};

/**
 * 分页配置
 */
export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
};

/**
 * 金额配置（单位：代币最小单位）
 */
export const AMOUNT_CONFIG = {
  // 最小申领金额
  MIN_CLAIM_AMOUNT: 1,
  
  // 最大申领金额
  MAX_CLAIM_AMOUNT: 10000,
  
  // 默认质押比例（百分比）
  DEFAULT_STAKING_RATIO: 50,
};

/**
 * 日志消息模板
 */
export const LOG_MESSAGES = {
  SERVER_START: '服务器已启动',
  SERVER_STOP: '服务器已停止',
  DATABASE_CONNECTED: '数据库已连接',
  DATABASE_DISCONNECTED: '数据库已断开',
  ZKP_KEY_LOADED: 'ZKP 密钥已加载',
  ZKP_VERIFICATION_SUCCESS: 'ZKP 验证成功',
  ZKP_VERIFICATION_FAILED: 'ZKP 验证失败',
};

/**
 * 导出所有常量
 */
export const constants = {
  ERROR_CODES,
  TRUST_LEVELS,
  ROLES,
  CHANNEL_STATES,
  PROPOSAL_STATES,
  TIME_CONSTANTS,
  RATE_LIMITS,
  ZKP_CONFIG,
  PAGINATION,
  AMOUNT_CONFIG,
  LOG_MESSAGES,
};
