/**
 * 输入验证工具函数
 * 
 * 职责：
 * - 验证用户输入数据格式
 * - 防止注入攻击
 * - 确保数据一致性
 * 
 * 安全规范：
 * - 所有外部输入必须验证
 * - 使用白名单而非黑名单
 * - 提供清晰的错误提示
 */

/**
 * 验证以太坊地址格式
 * 
 * @param {string} address - 待验证的地址
 * @returns {boolean} 是否有效
 * 
 * 验证规则：
 * - 必须以 0x 开头
 * - 长度为 42 字符
 * - 仅包含十六进制字符
 */
export function isValidEthAddress(address) {
  if (typeof address !== 'string') {
    return false;
  }
  
  // 基本格式验证
  if (!address.startsWith('0x') || address.length !== 42) {
    return false;
  }
  
  // 十六进制验证
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * 验证哈希值格式
 * 
 * @param {string} hash - 待验证的哈希值
 * @param {'sha256'|'keccak256'|'poseidon'} algorithm - 哈希算法类型
 * @returns {boolean} 是否有效
 * 
 * 验证规则：
 * - SHA-256/Keccak-256：64 字符十六进制
 * - Poseidon：可变长度，但必须是十六进制
 */
export function isValidHash(hash, algorithm = 'sha256') {
  if (typeof hash !== 'string') {
    return false;
  }
  
  // 十六进制前缀检查
  if (hash.startsWith('0x')) {
    hash = hash.slice(2);
  }
  
  // 长度验证
  if (algorithm === 'sha256' || algorithm === 'keccak256') {
    if (hash.length !== 64) {
      return false;
    }
  }
  
  // 十六进制验证
  return /^[0-9a-fA-F]+$/.test(hash);
}

/**
 * 验证时间戳
 * 
 * @param {number} timestamp - 待验证的时间戳
 * @param {Object} options - 验证选项
 * @param {boolean} options.requireFuture - 是否要求未来时间
 * @param {number} options.maxFuture - 最大未来时间（秒）
 * @returns {boolean} 是否有效
 */
export function isValidTimestamp(timestamp, options = {}) {
  const { requireFuture = false, maxFuture = null } = options;
  
  // 类型验证
  if (typeof timestamp !== 'number' || !Number.isInteger(timestamp)) {
    return false;
  }
  
  // 范围验证
  const now = Math.floor(Date.now() / 1000);
  
  if (timestamp <= 0) {
    return false;
  }
  
  // 未来时间验证
  if (requireFuture && timestamp <= now) {
    return false;
  }
  
  // 最大未来时间验证
  if (maxFuture && timestamp > now + maxFuture) {
    return false;
  }
  
  return true;
}

/**
 * 验证数字范围
 * 
 * @param {number} value - 待验证的值
 * @param {Object} options - 验证选项
 * @param {number} options.min - 最小值
 * @param {number} options.max - 最大值
 * @param {boolean} options.integer - 是否要求整数
 * @returns {boolean} 是否有效
 */
export function isValidNumber(value, options = {}) {
  const { min = null, max = null, integer = false } = options;
  
  // 类型验证
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return false;
  }
  
  // 整数验证
  if (integer && !Number.isInteger(value)) {
    return false;
  }
  
  // 范围验证
  if (min !== null && value < min) {
    return false;
  }
  
  if (max !== null && value > max) {
    return false;
  }
  
  return true;
}

/**
 * 验证字符串长度
 * 
 * @param {string} str - 待验证的字符串
 * @param {Object} options - 验证选项
 * @param {number} options.minLength - 最小长度
 * @param {number} options.maxLength - 最大长度
 * @returns {boolean} 是否有效
 */
export function isValidStringLength(str, options = {}) {
  const { minLength = 0, maxLength = null } = options;
  
  if (typeof str !== 'string') {
    return false;
  }
  
  if (str.length < minLength) {
    return false;
  }
  
  if (maxLength !== null && str.length > maxLength) {
    return false;
  }
  
  return true;
}

/**
 * 验证 IPFS CID 格式
 * 
 * @param {string} cid - 待验证的 CID
 * @returns {boolean} 是否有效
 */
export function isValidIPFSCID(cid) {
  if (typeof cid !== 'string') {
    return false;
  }
  
  // CID v0: Qm 开头，46 字符
  if (cid.startsWith('Qm') && cid.length === 46) {
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
  }
  
  // CID v1: 更复杂的格式，这里简化验证
  if (cid.startsWith('bafy')) {
    return /^bafy[A-Za-z0-9]{50,}$/.test(cid);
  }
  
  return false;
}

/**
 * 验证数组内容
 * 
 * @param {Array} arr - 待验证的数组
 * @param {Function} validator - 元素验证函数
 * @returns {boolean} 是否有效
 */
export function isValidArray(arr, validator) {
  if (!Array.isArray(arr)) {
    return false;
  }
  
  if (arr.length === 0) {
    return false;
  }
  
  return arr.every(validator);
}

/**
 * 验证对象结构
 * 
 * @param {Object} obj - 待验证的对象
 * @param {Array<string>} requiredFields - 必需字段列表
 * @returns {boolean} 是否有效
 */
export function isValidObjectStructure(obj, requiredFields) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  return requiredFields.every(field => field in obj);
}

/**
 * 清理字符串输入（防 XSS）
 * 
 * @param {string} str - 待清理的字符串
 * @returns {string} 清理后的字符串
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  
  // 移除 HTML 标签
  let sanitized = str.replace(/<[^>]*>/g, '');
  
  // 移除特殊字符
  sanitized = sanitized.replace(/[<>\"'&]/g, '');
  
  // 去除首尾空格
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * 验证 ZKP 公开信号
 * 
 * @param {Array<string>} publicSignals - 公开信号数组
 * @param {number} expectedLength - 预期长度
 * @returns {boolean} 是否有效
 */
export function isValidPublicSignals(publicSignals, expectedLength) {
  if (!Array.isArray(publicSignals)) {
    return false;
  }
  
  if (publicSignals.length !== expectedLength) {
    return false;
  }
  
  // 验证每个信号都是有效的哈希值
  return publicSignals.every(signal => isValidHash(signal));
}
