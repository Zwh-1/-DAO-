/**
 * 哈希工具函数
 * 
 * 安全规范（最高优先级）：
 * - 🚫 严禁使用 MD5、SHA-1（存在碰撞攻击风险）
 * - ✅ 链上使用 keccak256（与 Solidity 兼容）
 * - ✅ 电路内使用 Poseidon（零知识证明友好）
 * - ✅ 链下数据完整性使用 SHA-256（抗碰撞性强）
 * 
 * 隐私保护：
 * - 日志脱敏：禁止输出明文哈希输入
 * - 输入验证：拒绝空值或超大输入（防止 DoS）
 * - 不可逆性：无法从哈希值反推原始数据
 * 
 * 使用场景：
 * - SHA-256：数据完整性校验、日志脱敏
 * - Keccak-256：与 Solidity 合约交互、链上承诺
 * - Poseidon：Circom 电路内部计算（需使用 circomlib）
 */

import crypto from 'crypto';

/**
 * SHA-256 哈希（推荐用于链下数据完整性校验）
 * 
 * @param {string|Buffer} data - 输入数据
 * @returns {string} 十六进制哈希值（64 字符）
 * 
 * 安全注释：
 * - 替代 MD5：SHA-256 抗碰撞性更强（128 位安全强度）
 * - 输入验证：拒绝空值或超大输入（防止 DoS 攻击）
 * - 应用场景：文件完整性校验、日志脱敏、非链上数据
 * @throws {Error} 当输入为空或超过 10MB 时抛出错误
 */
export function sha256(data) {
  // 输入验证：防止空值
  if (!data || (typeof data === 'string' && data.length === 0)) {
    throw new Error('[哈希安全] 输入不能为空');
  }
  
  // 转换为 Buffer（如果输入是字符串）
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;
  
  // 防止超大输入（> 10MB）导致内存溢出（DoS 防护）
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('[哈希安全] 输入过大（> 10MB），拒绝处理');
  }
  
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Keccak-256 哈希（与 Solidity 兼容）
 * 
 * @param {string|Buffer} data - 输入数据
 * @returns {string} 十六进制哈希值（64 字符，不含 0x 前缀）
 * 
 * 安全注释：
 * - 链上兼容：Solidity 的 keccak256() 使用此算法
 * - 非 SHA-3 标准：注意与 crypto.createHash('sha3-256') 区分
 * - 应用场景：链上承诺、地址计算、智能合约交互
 * 
 * 重要：
 * - 此函数使用 ethers.js 的 keccak256 实现以确保与 Solidity 完全兼容
 * - 如果使用 crypto.createHash('sha3-256') 会得到不同结果！
 * @throws {Error} 当输入为空时抛出错误
 */
export async function keccak256(data) {
  // 输入验证：防止空值
  if (!data || (typeof data === 'string' && data.length === 0)) {
    throw new Error('[哈希安全] 输入不能为空');
  }
  
  // 使用 ethers.js 的 keccak256 确保与 Solidity 兼容
  // 注意：不能使用 crypto.createHash('sha3-256')，因为结果不同！
  const { keccak256: ethersKeccak } = await import('ethers');
  
  // ethers 的 keccak256 需要 bytes 格式输入
  const bytes = typeof data === 'string' 
    ? Buffer.from(data, 'utf-8') 
    : data;
  
  // 返回不含 0x 前缀的哈希值
  return ethersKeccak(bytes).slice(2);
}

/**
 * 日志脱敏哈希
 * 
 * 用途：在日志中记录数据指纹，但不暴露明文
 * 符合 GDPR/PIPL 数据最小化原则
 * 
 * @param {string} data - 敏感数据（如用户 ID、健康数据、地址）
 * @param {number} prefixLength - 保留前缀长度（默认 8 字符）
 * @returns {string} 脱敏后的哈希（如：0x3a7f8b2c...）
 * 
 * 隐私保护注释：
 * - 不可逆：无法从哈希值反推原始数据
 * - 截断显示：仅展示前 8 位，防止哈希碰撞识别
 * - 应用场景：审计日志、调试信息、监控告警
 */
export function hashForLogging(data, prefixLength = 8) {
  // 输入验证：允许空值（返回特殊标记）
  if (!data) {
    return '0x[NULL]';
  }
  
  const fullHash = sha256(String(data));
  
  // 截断显示，防止通过完整哈希识别数据
  return `0x${fullHash.substring(0, prefixLength)}...`;
}

/**
 * 双重哈希（增强安全性）
 * 
 * 用途：防止长度扩展攻击
 * 公式：SHA256(SHA256(data))
 * 
 * @param {string|Buffer} data - 输入数据
 * @returns {string} 双重哈希值
 * 
 * 安全注释：
 * - 防御长度扩展攻击：攻击者无法在未知原数据的情况下扩展哈希
 * - 比特币地址生成使用此技术
 * - 应用场景：高安全需求的数据指纹
 */
export function doubleSha256(data) {
  const firstHash = sha256(data);
  return sha256(Buffer.from(firstHash, 'hex'));
}

/**
 * HMAC-SHA256（带密钥的哈希）
 * 
 * 用途：消息认证码（MAC），验证数据完整性和来源
 * 
 * @param {string|Buffer} data - 输入数据
 * @param {string|Buffer} secretKey - 密钥（必须保密）
 * @returns {string} HMAC 哈希值
 * 
 * 安全注释：
 * - 密钥保护：密钥泄露会导致 MAC 失效
 * - 应用场景：API 签名、Webhook 验证、消息认证
 */
export function hmacSha256(data, secretKey) {
  if (!secretKey) {
    throw new Error('[HMAC 安全] 密钥不能为空');
  }
  
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * 验证哈希值格式是否正确
 * 
 * @param {string} hash - 待验证的哈希值
 * @param {'sha256'|'keccak256'} algorithm - 哈希算法类型
 * @returns {boolean} 是否有效
 * 
 * 安全注释：
 * - 格式验证：确保哈希长度为 64 字符（十六进制）
 * - 防止注入：拒绝非十六进制字符
 */
export function isValidHash(hash, algorithm = 'sha256') {
  if (typeof hash !== 'string') {
    return false;
  }
  
  // SHA-256 和 Keccak-256 都是 64 字符十六进制
  if (hash.length !== 64) {
    return false;
  }
  
  // 验证是否为十六进制
  return /^[0-9a-fA-F]+$/.test(hash);
}
