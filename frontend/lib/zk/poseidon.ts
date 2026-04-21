/**
 * Poseidon 哈希工具
 * 
 * 功能：
 * - 计算 Poseidon 哈希（用于 ZK 电路）
 * - 前端计算 commitment
 * - 保护隐私（不传输 secret）
 * 
 * 依赖：
 * - poseidon-lite（轻量级 Poseidon 实现）
 */

import { poseidon1 } from 'poseidon-lite';

/**
 * 计算身份承诺（Commitment）
 * 
 * 公式：
 * commitment = PoseidonHash([socialIdHash, secret])
 * 
 * @param socialIdHash 社交 ID 哈希（已脱敏）
 * @param secret 私有密钥（前端生成，不离端）
 * @returns 承诺哈希（大整数）
 */
export function calculateCommitment(
  socialIdHash: bigint | string,
  secret: bigint | Uint8Array | string
): bigint {
  // 转换为 BigInt
  const socialIdHashBigInt = typeof socialIdHash === 'string'
    ? BigInt(socialIdHash)
    : socialIdHash;
  
  const secretBigInt = typeof secret === 'string'
    ? BigInt(secret)
    : secret instanceof Uint8Array
    ? bytesToBigInt(secret)
    : secret;

  // 计算 Poseidon 哈希（使用 poseidon1 处理 2 个输入）
  const commitment = poseidon1([socialIdHashBigInt, secretBigInt]);
  
  return commitment;
}

/**
 * 计算 Nullifier
 * 
 * 公式：
 * nullifier = PoseidonHash([nullifierKey, secret])
 * 
 * @param nullifierKey Nullifier 密钥（如 airdrop ID）
 * @param secret 私有密钥
 * @returns Nullifier 哈希
 */
export function calculateNullifier(
  nullifierKey: bigint | string,
  secret: bigint | Uint8Array | string
): bigint {
  const nullifierKeyBigInt = typeof nullifierKey === 'string'
    ? BigInt(nullifierKey)
    : nullifierKey;
  
  const secretBigInt = typeof secret === 'string'
    ? BigInt(secret)
    : secret instanceof Uint8Array
    ? bytesToBigInt(secret)
    : secret;

  // 计算 Poseidon 哈希（使用 poseidon1）
  const nullifier = poseidon1([nullifierKeyBigInt, secretBigInt]);
  
  return nullifier;
}

/**
 * 将字节数组转换为 BigInt
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt(`0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`);
}

/**
 * 将字符串转换为 BigInt
 */
export function stringToBigInt(str: string): bigint {
  return BigInt(`0x${Buffer.from(str, 'utf-8').toString('hex')}`);
}

/**
 * 生成随机 secret
 * 
 * @returns 32 字节随机数（Uint8Array）
 */
export function generateSecret(): Uint8Array {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

/**
 * 格式化大整数为 0x 开头的十六进制字符串
 */
export function formatBigInt(value: bigint): string {
  return `0x${value.toString(16)}`;
}

/**
 * 导出所有工具
 */
export const poseidonUtils = {
  calculateCommitment,
  calculateNullifier,
  stringToBigInt,
  generateSecret,
  formatBigInt,
  bytesToBigInt,
};
