/**
 * 错误类型定义和工具函数
 * 
 * 功能：
 * - 统一定义错误类型
 * - 错误映射（后端错误 -> 用户友好提示）
 * - 错误日志（脱敏）
 * - 错误恢复建议
 * 
 * 隐私保护：
 * - 不记录敏感数据到日志
 * - 地址和 ID 脱敏处理
 * - 符合 GDPR/PIPL 数据最小化原则
 * 
 * 使用示例：
 *   const error = createError('网络错误', ErrorCode.NETWORK_ERROR, ErrorLevel.ERROR, undefined, { url: '...' });
 *   logError(error, 'claim.submit');
 *   const message = getUserFriendlyMessage(error);
 * 
 * @module lib/errors
 */

/**
 * 错误代码映射
 */
export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // 认证错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  NONCE_EXPIRED = 'NONCE_EXPIRED',
  
  // 钱包错误
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_REJECTED = 'WALLET_REJECTED',
  WALLET_SWITCH_NETWORK = 'WALLET_SWITCH_NETWORK',
  WALLET_NO_ACCOUNTS = 'WALLET_NO_ACCOUNTS',
  
  // ZK 证明错误
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
  PROOF_VERIFICATION_FAILED = 'PROOF_VERIFICATION_FAILED',
  CIRCUIT_LOAD_FAILED = 'CIRCUIT_LOAD_FAILED',
  WASM_LOAD_FAILED = 'WASM_LOAD_FAILED',
  PROOF_TIMEOUT = 'PROOF_TIMEOUT',
  INVALID_PUBLIC_SIGNALS = 'INVALID_PUBLIC_SIGNALS',
  DUPLICATE_NULLIFIER = 'DUPLICATE_NULLIFIER',
  MOCK_PROOF_NOT_ALLOWED = 'MOCK_PROOF_NOT_ALLOWED',
  
  // 身份错误
  IDENTITY_NOT_FOUND = 'IDENTITY_NOT_FOUND',
  IDENTITY_ALREADY_REGISTERED = 'IDENTITY_ALREADY_REGISTERED',
  IDENTITY_BANNED = 'IDENTITY_BANNED',
  COMMITMENT_MISMATCH = 'COMMITMENT_MISMATCH',
  
  // 空投错误
  AIRDROP_NOT_AVAILABLE = 'AIRDROP_NOT_AVAILABLE',
  AIRDROP_ALREADY_CLAIMED = 'AIRDROP_ALREADY_CLAIMED',
  AIRDROP_AMOUNT_EXCEEDED = 'AIRDROP_AMOUNT_EXCEEDED',
  NULLIFIER_REPLAY = 'NULLIFIER_REPLAY',
  
  // 交易错误
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  
  // 数据错误
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  
  // 服务器错误
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIG_ERROR = 'CONFIG_ERROR',
}

/**
 * 错误级别
 */
export enum ErrorLevel {
  /** 致命错误（需要立即处理） */
  CRITICAL = 'critical',
  /** 严重错误（影响功能） */
  ERROR = 'error',
  /** 警告（不影响主要功能） */
  WARNING = 'warning',
  /** 信息（用户提示） */
  INFO = 'info',
}

/**
 * 错误对象接口
 */
export interface AppError extends Error {
  /** 错误代码 */
  code?: ErrorCode;
  /** 错误级别 */
  level?: ErrorLevel;
  /** 原始错误 */
  originalError?: Error;
  /** 上下文信息（脱敏） */
  context?: Record<string, string>;
  /** 建议操作 */
  suggestion?: string;
}

/**
 * 创建应用错误
 */
export function createError(
  message: string,
  code?: ErrorCode,
  level?: ErrorLevel,
  originalError?: Error,
  context?: Record<string, string>,
  suggestion?: string
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.level = level;
  error.originalError = originalError;
  error.context = context;
  error.suggestion = suggestion;
  return error;
}

/**
 * 错误消息映射（后端错误 -> 用户友好提示）
 */
export const ERROR_MESSAGE_MAP: Record<string, string> = {
  // 网络错误
  [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
  [ErrorCode.TIMEOUT]: '请求超时，请重试',
  
  // 钱包错误
  [ErrorCode.WALLET_NOT_CONNECTED]: '请先连接钱包',
  [ErrorCode.WALLET_REJECTED]: '您拒绝了钱包签名',
  [ErrorCode.WALLET_SWITCH_NETWORK]: '请切换到正确的网络',
  [ErrorCode.WALLET_NO_ACCOUNTS]: '钱包没有可用账户',
  
  // ZK 证明错误
  [ErrorCode.PROOF_GENERATION_FAILED]: '证明生成失败，请重试（您的原始数据不会离开设备）',
  [ErrorCode.PROOF_VERIFICATION_FAILED]: '证明验证失败',
  [ErrorCode.CIRCUIT_LOAD_FAILED]: '电路加载失败，请刷新页面',
  [ErrorCode.WASM_LOAD_FAILED]: 'WASM 加载失败，请检查网络连接',
  [ErrorCode.PROOF_TIMEOUT]: '证明生成超时，请重试',
  [ErrorCode.INVALID_PUBLIC_SIGNALS]: '公开信号无效',
  [ErrorCode.DUPLICATE_NULLIFIER]: '检测到重复申领',
  [ErrorCode.MOCK_PROOF_NOT_ALLOWED]: '生产环境不允许使用模拟证明',
  
  // 身份错误
  [ErrorCode.IDENTITY_NOT_FOUND]: '未找到身份信息',
  [ErrorCode.IDENTITY_ALREADY_REGISTERED]: '身份已注册',
  [ErrorCode.IDENTITY_BANNED]: '该身份已被禁用',
  [ErrorCode.COMMITMENT_MISMATCH]: '承诺不匹配',
  
  // 空投错误
  [ErrorCode.AIRDROP_NOT_AVAILABLE]: '空投活动已结束',
  [ErrorCode.AIRDROP_ALREADY_CLAIMED]: '您已领取过空投',
  [ErrorCode.AIRDROP_AMOUNT_EXCEEDED]: '申领金额超出限制',
  [ErrorCode.NULLIFIER_REPLAY]: '重复申领检测',
  
  // 交易错误
  [ErrorCode.TRANSACTION_FAILED]: '交易失败',
  [ErrorCode.TRANSACTION_REJECTED]: '交易被拒绝',
  [ErrorCode.GAS_ESTIMATION_FAILED]: 'Gas 估算失败',
  [ErrorCode.INSUFFICIENT_GAS]: 'Gas 不足',
  [ErrorCode.TRANSACTION_TIMEOUT]: '交易确认超时',
  
  // 数据错误
  [ErrorCode.DATA_NOT_FOUND]: '数据不存在',
  [ErrorCode.DATA_VALIDATION_FAILED]: '数据验证失败',
  [ErrorCode.INVALID_INPUT]: '输入无效',
  [ErrorCode.RECORD_NOT_FOUND]: '记录不存在',
  
  // 服务器错误
  [ErrorCode.SERVER_ERROR]: '服务器内部错误',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [ErrorCode.CONFIG_ERROR]: '服务器配置错误',
  
  // 默认
  [ErrorCode.UNKNOWN_ERROR]: '发生未知错误',
};

/**
 * 错误恢复建议映射
 */
export const ERROR_SUGGESTION_MAP: Record<string, string> = {
  [ErrorCode.NETWORK_ERROR]: '请检查网络连接后重试',
  [ErrorCode.TIMEOUT]: '等待几秒后重试，或检查网络速度',
  [ErrorCode.WALLET_NOT_CONNECTED]: '点击右上角"连接钱包"按钮',
  [ErrorCode.WALLET_REJECTED]: '请在钱包弹窗中点击"确认"',
  [ErrorCode.WALLET_SWITCH_NETWORK]: '请在钱包中切换到正确的网络',
  [ErrorCode.PROOF_GENERATION_FAILED]: '刷新页面后重试，确保浏览器支持 WASM',
  [ErrorCode.CIRCUIT_LOAD_FAILED]: '刷新页面重新加载电路文件',
  [ErrorCode.WASM_LOAD_FAILED]: '检查网络连接，刷新页面',
  [ErrorCode.PROOF_TIMEOUT]: '设备性能较低，请耐心等待或重试',
  [ErrorCode.DUPLICATE_NULLIFIER]: '每个身份只能申领一次',
  [ErrorCode.TRANSACTION_TIMEOUT]: '等待区块链确认，或查看交易历史',
  [ErrorCode.GAS_ESTIMATION_FAILED]: '请确保钱包有足够的 ETH 支付 Gas',
  [ErrorCode.INSUFFICIENT_GAS]: '请充值 ETH 以支付 Gas 费用',
};

/**
 * 获取用户友好的错误消息
 * 
 * @param error 错误对象
 * @returns 用户友好的错误消息
 */
export function getUserFriendlyMessage(error: Error | AppError): string {
  // 检查是否为 AppError
  if (isAppError(error) && error.code) {
    return ERROR_MESSAGE_MAP[error.code] || error.message;
  }
  
  // 根据错误消息匹配
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return ERROR_MESSAGE_MAP[ErrorCode.NETWORK_ERROR];
  }
  
  if (message.includes('timeout')) {
    return ERROR_MESSAGE_MAP[ErrorCode.TIMEOUT];
  }
  
  if (message.includes('wallet') || message.includes('connection') || message.includes('connect')) {
    return ERROR_MESSAGE_MAP[ErrorCode.WALLET_NOT_CONNECTED];
  }
  
  if (message.includes('proof') || message.includes('witness') || message.includes('circuit')) {
    return ERROR_MESSAGE_MAP[ErrorCode.PROOF_GENERATION_FAILED];
  }
  
  if (message.includes('gas')) {
    return ERROR_MESSAGE_MAP[ErrorCode.INSUFFICIENT_GAS];
  }
  
  if (message.includes('duplicate') || message.includes('replay')) {
    return ERROR_MESSAGE_MAP[ErrorCode.DUPLICATE_NULLIFIER];
  }
  
  if (message.includes('unauthorized') || message.includes('token')) {
    return ERROR_MESSAGE_MAP[ErrorCode.UNAUTHORIZED];
  }
  
  // 默认消息
  return error.message || ERROR_MESSAGE_MAP[ErrorCode.UNKNOWN_ERROR];
}

/**
 * 获取错误恢复建议
 * 
 * @param error 错误对象
 * @returns 恢复建议
 */
export function getErrorSuggestion(error: Error | AppError): string {
  if (isAppError(error) && error.code) {
    // 优先使用错误对象中的建议
    if (error.suggestion) {
      return error.suggestion;
    }
    // 使用映射表
    return ERROR_SUGGESTION_MAP[error.code] || '请重试或联系客服';
  }
  
  // 根据错误消息匹配
  const message = error.message.toLowerCase();
  
  if (message.includes('gas')) {
    return ERROR_SUGGESTION_MAP[ErrorCode.GAS_ESTIMATION_FAILED];
  }
  
  if (message.includes('proof')) {
    return ERROR_SUGGESTION_MAP[ErrorCode.PROOF_GENERATION_FAILED];
  }
  
  // 默认建议
  return '请重试或联系客服';
}

/**
 * 判断是否为 AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof Error && 'code' in error;
}

/**
 * 脱敏错误日志
 * 
 * @param error 错误对象
 * @param context 上下文信息
 */
export function logError(error: Error | AppError, context?: string): void {
  // 脱敏处理
  const sanitizedError = {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    code: isAppError(error) ? error.code : undefined,
    context: sanitizeContext(isAppError(error) ? error.context : undefined),
  };

  // 记录错误（不记录敏感数据）
  console.error(`[Error]${context ? ` ${context}` : ''}:`, sanitizedError);
}

/**
 * 脱敏上下文信息
 */
function sanitizeContext(context?: Record<string, string>): Record<string, string> | undefined {
  if (!context) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(context)) {
    // 地址脱敏（保留前后缀）
    if (key.includes('address') || key.includes('hash')) {
      sanitized[key] = value.slice(0, 6) + '...' + value.slice(-4);
    }
    // 其他敏感数据不记录
    else if (key.includes('secret') || key.includes('private') || key.includes('key')) {
      sanitized[key] = '[REDACTED]';
    }
    // 普通数据
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 导出错误工具
 */
export const errorUtils = {
  createError,
  getUserFriendlyMessage,
  isAppError,
  logError,
  sanitizeContext,
};
