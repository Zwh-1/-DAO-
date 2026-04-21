/**
 * 钱包错误映射与标准化工具
 * 
 * 设计目标：
 * 1. 将底层错误（ethers.js、MetaMask）映射为用户友好的提示
 * 2. 统一错误码，便于 UI 层判断处理
 * 3. 脱敏处理，避免泄露敏感信息
 * 
 * 安全说明：
 * - 错误信息中不包含明文地址、私钥、助记词
 * - 所有错误日志自动脱敏
 */

/**
 * 标准错误码枚举
 * 
 * 分类：
 * - USER_：用户主动操作（拒绝、取消）
 * - NETWORK_：网络/连接问题
 * - SECURITY_：安全相关（锁定、密码错误）
 * - CONTRACT_：合约交互错误
 * - INTERNAL_：内部错误（代码 Bug）
 */
export enum WalletErrorCode {
  // 用户主动操作
  USER_REJECTED = 'USER_REJECTED',           // 用户拒绝连接/签名
  USER_CANCELLED = 'USER_CANCELLED',         // 用户取消操作
  
  // 网络/连接问题
  NETWORK_ERROR = 'NETWORK_ERROR',           // 网络连接失败
  RPC_ERROR = 'RPC_ERROR',                   // RPC 节点错误
  TIMEOUT = 'TIMEOUT',                       // 请求超时
  CHAIN_NOT_FOUND = 'CHAIN_NOT_FOUND',       // 链不存在
  
  // 安全相关
  WALLET_LOCKED = 'WALLET_LOCKED',           // 钱包已锁定（内置钱包）
  WALLET_NOT_CREATED = 'WALLET_NOT_CREATED', // 钱包未创建
  INVALID_PASSWORD = 'INVALID_PASSWORD',     // 密码错误
  PRIVATE_KEY_EXPOSED = 'PRIVATE_KEY_EXPOSED', // 私钥泄露风险
  
  // 合约交互
  TRANSACTION_FAILED = 'TRANSACTION_FAILED', // 交易失败
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED', // Gas 估算失败
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE', // 余额不足
  REVERTED = 'REVERTED',                     // 交易回滚
  
  // 内部错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',         // 内部错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',           // 未知错误
}

/**
 * 错误映射结果
 */
export interface MappedWalletError {
  /** 错误码（用于程序判断） */
  uiCode: WalletErrorCode
  /** 用户友好的错误提示（中文） */
  uiMessage: string
  /** 原始错误对象（用于调试，生产环境不显示） */
  originalError?: any
  /** 建议的恢复操作 */
  suggestion?: string
}

/**
 * 钱包错误映射器
 * 
 * 支持的错误源：
 * - MetaMask RPC 错误（code: 4001, 4902, etc.）
 * - Ethers.js 错误
 * - 自定义错误
 * 
 * @param error 任意错误对象
 * @returns 标准化错误映射
 */
export function mapWalletError(error: any): MappedWalletError {
  // 1. 处理字符串错误
  if (typeof error === 'string') {
    return {
      uiCode: WalletErrorCode.UNKNOWN_ERROR,
      uiMessage: error,
      suggestion: '请重试或联系技术支持'
    }
  }

  // 2. 处理 null/undefined
  if (!error) {
    return {
      uiCode: WalletErrorCode.UNKNOWN_ERROR,
      uiMessage: '发生未知错误',
      suggestion: '请刷新页面后重试'
    }
  }

  // 3. 提取错误信息（脱敏处理）
  const errorCode = error?.code ?? error?.name ?? 'UNKNOWN'
  const errorMessage = error?.message ?? error?.reason ?? '未知错误'
  
  // 4. 根据错误码映射
  let uiCode: WalletErrorCode = WalletErrorCode.UNKNOWN_ERROR
  let uiMessage: string = errorMessage
  let suggestion: string | undefined = '请重试或联系技术支持'

  // MetaMask RPC 错误码映射
  switch (errorCode) {
    case 4001:
      uiCode = WalletErrorCode.USER_REJECTED
      uiMessage = '您拒绝了连接请求'
      suggestion = '如需使用钱包功能，请重新点击连接按钮'
      break

    case 4902:
      uiCode = WalletErrorCode.CHAIN_NOT_FOUND
      uiMessage = '该网络未配置'
      suggestion = '请先在钱包中添加该网络'
      break

    case -32602:
    case -32603:
      uiCode = WalletErrorCode.RPC_ERROR
      uiMessage = 'RPC 节点响应异常'
      suggestion = '请检查网络连接或切换 RPC 节点'
      break

    case 'TIMEOUT':
      uiCode = WalletErrorCode.TIMEOUT
      uiMessage = '请求超时，请检查网络'
      suggestion = '请确保网络畅通后重试'
      break

    case 'USER_REJECTED':
    case 'ACTION_REJECTED':
      uiCode = WalletErrorCode.USER_REJECTED
      uiMessage = '您拒绝了签名请求'
      suggestion = '如需继续操作，请重新发起交易'
      break

    case 'WALLET_LOCKED':
      uiCode = WalletErrorCode.WALLET_LOCKED
      uiMessage = '钱包已锁定，请输入密码解锁'
      suggestion = undefined
      break

    case 'WALLET_NOT_CREATED':
      uiCode = WalletErrorCode.WALLET_NOT_CREATED
      uiMessage = '钱包尚未创建'
      suggestion = '请先创建或导入钱包'
      break

    case 'INVALID_PASSWORD':
      uiCode = WalletErrorCode.INVALID_PASSWORD
      uiMessage = '密码错误'
      suggestion = '请检查密码后重试，连续错误 5 次将锁定钱包'
      break

    case 'INSUFFICIENT_FUNDS':
      uiCode = WalletErrorCode.INSUFFICIENT_BALANCE
      uiMessage = '账户余额不足'
      suggestion = '请充值后再试'
      break

    case 'UNPREDICTABLE_GAS_LIMIT':
      uiCode = WalletErrorCode.GAS_ESTIMATION_FAILED
      uiMessage = 'Gas 估算失败，交易可能失败'
      suggestion = '请检查交易参数或联系技术支持'
      break

    default:
      // 根据错误消息内容判断
      if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        uiCode = WalletErrorCode.USER_REJECTED
        uiMessage = '您拒绝了操作请求'
        suggestion = '如需继续，请重新发起'
      } else if (errorMessage.includes('timeout')) {
        uiCode = WalletErrorCode.TIMEOUT
        uiMessage = '请求超时'
        suggestion = '请检查网络连接后重试'
      } else if (errorMessage.includes('network') || errorMessage.includes('ETIMEDOUT')) {
        uiCode = WalletErrorCode.NETWORK_ERROR
        uiMessage = '网络连接失败'
        suggestion = '请检查网络或代理设置'
      } else if (errorMessage.includes('password') || errorMessage.includes('decrypt')) {
        uiCode = WalletErrorCode.INVALID_PASSWORD
        uiMessage = '密码错误或无法解密'
        suggestion = '请检查密码后重试'
      } else if (errorMessage.includes('gas') || errorMessage.includes('gas')) {
        uiCode = WalletErrorCode.GAS_ESTIMATION_FAILED
        uiMessage = 'Gas 设置异常'
        suggestion = '请调整 Gas 限制后重试'
      }
  }

  // 5. 脱敏处理（移除可能的敏感信息）
  const sanitizedMessage = sanitizeErrorMessage(uiMessage)

  return {
    uiCode,
    uiMessage: sanitizedMessage,
    originalError: error, // 保留原始错误供调试
    suggestion
  }
}

/**
 * 错误消息脱敏工具
 * 
 * 脱敏规则：
 * 1. 移除完整的钱包地址（保留前 6 后 4）
 * 2. 移除私钥（0x 开头的 64 字符 hex）
 * 3. 移除助记词（12/24 个单词）
 * 
 * @param message 原始错误消息
 * @returns 脱敏后的消息
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return '发生错误'

  let sanitized = message

  // 1. 脱敏钱包地址（0x 开头，40 字符）
  sanitized = sanitized.replace(/0x[a-fA-F0-9]{40}/g, (match) => {
    return `${match.slice(0, 6)}...${match.slice(-4)}`
  })

  // 2. 脱敏私钥（0x 开头，64 字符）
  sanitized = sanitized.replace(/0x[a-fA-F0-9]{64}/g, '0x[PRIVATE_KEY_REDACTED]')

  // 3. 脱敏助记词（12 或 24 个英文单词）
  const mnemonicPattern = /\b(?:\w+\s+){11,23}\w+\b/gi
  sanitized = sanitized.replace(mnemonicPattern, '[MNEMONIC_REDACTED]')

  return sanitized
}

/**
 * 判断是否为用户拒绝错误
 */
export function isUserRejected(error: any): boolean {
  const mapped = mapWalletError(error)
  return mapped.uiCode === WalletErrorCode.USER_REJECTED
}

/**
 * 判断是否为网络错误
 */
export function isNetworkError(error: any): boolean {
  const mapped = mapWalletError(error)
  return [
    WalletErrorCode.NETWORK_ERROR,
    WalletErrorCode.RPC_ERROR,
    WalletErrorCode.TIMEOUT
  ].includes(mapped.uiCode)
}

/**
 * 判断是否为安全相关错误
 */
export function isSecurityError(error: any): boolean {
  const mapped = mapWalletError(error)
  return [
    WalletErrorCode.WALLET_LOCKED,
    WalletErrorCode.WALLET_NOT_CREATED,
    WalletErrorCode.INVALID_PASSWORD,
    WalletErrorCode.PRIVATE_KEY_EXPOSED
  ].includes(mapped.uiCode)
}

/**
 * 抛出标准化钱包错误
 * 
 * @param code 错误码
 * @param message 自定义消息（可选）
 */
export function throwWalletError(code: WalletErrorCode, message?: string): never {
  const errorMessages: Record<WalletErrorCode, string> = {
    [WalletErrorCode.USER_REJECTED]: '用户拒绝了操作',
    [WalletErrorCode.USER_CANCELLED]: '用户取消了操作',
    [WalletErrorCode.NETWORK_ERROR]: '网络连接失败',
    [WalletErrorCode.RPC_ERROR]: 'RPC 节点错误',
    [WalletErrorCode.TIMEOUT]: '请求超时',
    [WalletErrorCode.CHAIN_NOT_FOUND]: '链不存在',
    [WalletErrorCode.WALLET_LOCKED]: '钱包已锁定',
    [WalletErrorCode.WALLET_NOT_CREATED]: '钱包未创建',
    [WalletErrorCode.INVALID_PASSWORD]: '密码错误',
    [WalletErrorCode.PRIVATE_KEY_EXPOSED]: '私钥泄露风险',
    [WalletErrorCode.TRANSACTION_FAILED]: '交易失败',
    [WalletErrorCode.GAS_ESTIMATION_FAILED]: 'Gas 估算失败',
    [WalletErrorCode.INSUFFICIENT_BALANCE]: '余额不足',
    [WalletErrorCode.REVERTED]: '交易回滚',
    [WalletErrorCode.INTERNAL_ERROR]: '内部错误',
    [WalletErrorCode.UNKNOWN_ERROR]: '未知错误'
  }

  const errorMessage = message || errorMessages[code]
  const error = new Error(errorMessage)
  error.name = code
  throw error
}
