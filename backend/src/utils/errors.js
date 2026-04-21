/**
 * 统一错误处理模块
 * 
 * 功能：
 * - 标准错误类层次结构
 * - 错误码映射表
 * - 统一错误响应格式
 * - 错误堆栈追踪
 * 
 * 使用示例：
 *   throw new AppError(4001, "参数验证失败", { field: "email" });
 *   throw new ValidationError("邮箱格式不正确");
 *   throw new DatabaseError("连接失败", { retryable: true });
 * 
 * @module utils/errors
 */

/**
 * 错误码映射表
 * 
 * 错误码规则：
 * - 1xxx: 认证相关
 * - 2xxx: ZK 证明相关
 * - 3xxx: 数据库相关
 * - 4xxx: 业务逻辑相关
 * - 5xxx: 服务器内部错误
 * - 9xxx: 限流、权限等其他错误
 */
export const ERROR_CODES = {
  // 认证相关 (1xxx)
  INVALID_SIGNATURE: 1001,
  TOKEN_EXPIRED: 1002,
  TOKEN_INVALID: 1003,
  NONCE_EXPIRED: 1004,
  UNAUTHORIZED: 1005,
  
  // ZK 证明相关 (2xxx)
  PROOF_INVALID: 2001,
  DUPLICATE_NULLIFIER: 2002,
  CIRCUIT_ERROR: 2003,
  WASM_LOAD_FAILED: 2004,
  PROOF_TIMEOUT: 2005,
  INVALID_PUBLIC_SIGNALS: 2006,
  PROOF_GENERATION_FAILED: 2007,
  PROOF_VERIFICATION_FAILED: 2008,
  MOCK_PROOF_NOT_ALLOWED: 2009,
  
  // 数据库相关 (3xxx)
  DATABASE_ERROR: 3001,
  DATABASE_CONNECTION_FAILED: 3002,
  DATABASE_QUERY_FAILED: 3003,
  DATABASE_TIMEOUT: 3004,
  DUPLICATE_ENTRY: 3005,
  RECORD_NOT_FOUND: 3006,
  
  // 业务逻辑相关 (4xxx)
  VALIDATION_ERROR: 4001,
  INVALID_PARAM: 4002,
  INSUFFICIENT_PERMISSION: 4003,
  RESOURCE_NOT_FOUND: 4004,
  RESOURCE_EXHAUSTED: 4005,
  INVALID_STATE: 4006,
  BUSINESS_RULE_VIOLATION: 4007,
  AMOUNT_MISMATCH: 4008,
  NULLIFIER_MISMATCH: 4009,
  
  // 服务器内部错误 (5xxx)
  INTERNAL_ERROR: 5001,
  SERVICE_UNAVAILABLE: 5002,
  CONFIG_ERROR: 5003,
  DEPENDENCY_ERROR: 5004,
  JWT_NOT_CONFIGURED: 5005,
  
  // 其他错误 (9xxx)
  RATE_LIMIT_EXCEEDED: 9001,
  ADMIN_TOKEN_REQUIRED: 9002,
  ADDRESS_MISMATCH: 9003,
  NETWORK_ERROR: 9004,
  GAS_ESTIMATION_FAILED: 9005,
};

/**
 * 错误码到 HTTP 状态码的映射
 */
export const ERROR_CODE_TO_HTTP = {
  // 认证相关 -> 401
  1001: 401,
  1002: 401,
  1003: 401,
  1004: 401,
  1005: 401,
  
  // ZK 证明相关 -> 400
  2001: 400,
  2002: 409, // 冲突
  2003: 400,
  2004: 500,
  2005: 408, // 超时
  2006: 400,
  2007: 400,
  2008: 400,
  2009: 400,
  
  // 数据库相关 -> 500 或 409
  3001: 500,
  3002: 503, // 服务不可用
  3003: 500,
  3004: 504, // 网关超时
  3005: 409, // 冲突
  3006: 404,
  
  // 业务逻辑相关 -> 400 或 403
  4001: 400,
  4002: 400,
  4003: 403,
  4004: 404,
  4005: 429,
  4006: 400,
  4007: 400,
  4008: 400,
  4009: 400,
  
  // 服务器内部错误 -> 500
  5001: 500,
  5002: 503,
  5003: 500,
  5004: 500,
  5005: 500,
  
  // 其他错误 -> 403 或 429
  9001: 429,
  9002: 403,
  9003: 403,
  9004: 500,
  9005: 500,
};

/**
 * 获取错误码对应的 HTTP 状态码
 * 
 * @param {number} code 错误码
 * @returns {number} HTTP 状态码
 */
export function getHttpStatusCode(code) {
  return ERROR_CODE_TO_HTTP[code] || 500;
}

/**
 * 应用错误基类
 * 
 * 所有自定义错误都应继承此类
 * 
 * @example
 * throw new AppError(4001, "参数验证失败", { field: "email" });
 */
export class AppError extends Error {
  /**
   * @param {number} code 错误码
   * @param {string} message 错误消息
   * @param {Object} [details] 附加信息（不敏感）
   * @param {Error} [cause] 原始错误（用于堆栈追踪）
   */
  constructor(code, message, details = {}, cause = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.cause = cause;
    this.timestamp = Date.now();
    
    // 捕获堆栈追踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // 标记为应用错误（便于中间件识别）
    this.isAppError = true;
  }
  
  /**
   * 获取 HTTP 状态码
   * 
   * @returns {number} HTTP 状态码
   */
  getHttpStatusCode() {
    return getHttpStatusCode(this.code);
  }
  
  /**
   * 转换为响应对象
   * 
   * @returns {Object} 错误响应对象
   */
  toJSON() {
    return {
      code: this.code,
      error: this.message,
      details: this.details,
      timestamp: this.timestamp,
      // 开发环境包含堆栈信息
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    };
  }
}

/**
 * 认证错误
 * 
 * @example
 * throw new AuthenticationError("Token 已过期");
 */
export class AuthenticationError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.UNAUTHORIZED, message, details);
  }
}

/**
 * 验证错误
 * 
 * @example
 * throw new ValidationError("邮箱格式不正确", { field: "email" });
 */
export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.VALIDATION_ERROR, message, details);
  }
}

/**
 * ZK 证明错误
 * 
 * @example
 * throw new ZKProofError("证明验证失败", { circuit: "identity" });
 */
export class ZKProofError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.PROOF_INVALID, message, details);
  }
}

/**
 * 数据库错误
 * 
 * @example
 * throw new DatabaseError("查询失败", { query: "SELECT ...", retryable: true });
 */
export class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.DATABASE_ERROR, message, details);
  }
}

/**
 * 资源未找到错误
 * 
 * @example
 * throw new NotFoundError("用户不存在", { userId: "0x..." });
 */
export class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.RESOURCE_NOT_FOUND, message, details);
  }
}

/**
 * 权限不足错误
 * 
 * @example
 * throw new ForbiddenError("需要管理员权限", { required: "admin" });
 */
export class ForbiddenError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.INSUFFICIENT_PERMISSION, message, details);
  }
}

/**
 * 限流错误
 * 
 * @example
 * throw new RateLimitError("请求过于频繁", { retryAfter: 60 });
 */
export class RateLimitError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.RATE_LIMIT_EXCEEDED, message, details);
  }
}

/**
 * 服务器内部错误
 * 
 * @example
 * throw new InternalError("未知错误", { context: "claim.submit" });
 */
export class InternalError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.INTERNAL_ERROR, message, details);
  }
}

/**
 * 配置错误
 * 
 * @example
 * throw new ConfigError("JWT_SECRET 未配置");
 */
export class ConfigError extends AppError {
  constructor(message, details = {}) {
    super(ERROR_CODES.CONFIG_ERROR, message, details);
  }
}

/**
 * 错误处理中间件
 * 
 * 统一处理所有错误并返回标准格式
 * 
 * @param {Error} err 错误对象
 * @param {Object} req Express 请求对象
 * @param {Object} res Express 响应对象
 * @param {Function} next Express 下一个中间件
 */
export function errorHandler(err, req, res, next) {
  // 记录错误日志（脱敏处理）
  console.error("[error]", {
    name: err.name,
    code: err.code,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
  
  // 处理 AppError
  if (err instanceof AppError) {
    const statusCode = err.getHttpStatusCode();
    return res.status(statusCode).json(err.toJSON());
  }
  
  // 处理未知错误
  const internalError = new InternalError(
    process.env.NODE_ENV === "production" 
      ? "服务器内部错误" 
      : err.message,
    {
      type: err.constructor.name,
      // 生产环境不暴露堆栈信息
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    }
  );
  
  return res.status(500).json(internalError.toJSON());
}

/**
 * 异步处理器包装器
 * 
 * 自动捕获异步错误并传递给错误处理中间件
 * 
 * @param {Function} fn 异步处理函数
 * @returns {Function} 包装后的处理函数
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
