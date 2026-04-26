/**
 * 统一格式化工具库
 * 
 * 职责：
 * - 地址脱敏格式化
 * - 时间戳格式化
 * - 交易哈希格式化
 * - 数字格式化
 * 
 * 安全约束：
 * - 地址格式化仅用于展示，不用于链上交互
 * - 时间戳统一使用 Unix 秒级
 * - 所有函数需处理 null/undefined 边界
 */

/**
 * 地址脱敏格式化
 * 
 * @param address - 以太坊地址（0x 开头 40 字符）
 * @param prefixLength - 前缀保留字符数（默认 6）
 * @param suffixLength - 后缀保留字符数（默认 4）
 * @returns 脱敏后的地址字符串，如 0x1234...5678
 * 
 * @example
 * formatAddress('0x1234567890abcdef1234567890abcdef12345678')
 * // => '0x123456...345678'
 */
export function formatAddress(
  address: string | null | undefined,
  prefixLength: number = 6,
  suffixLength: number = 4,
): string {
  if (!address) return '';
  
  const addr = address.startsWith('0x') ? address : `0x${address}`;
  if (addr.length < prefixLength + suffixLength + 2) {
    return addr; // 地址过短，直接返回
  }
  
  return `${addr.slice(0, prefixLength + 2)}...${addr.slice(-suffixLength)}`;
}

/**
 * 交易哈希格式化
 * 
 * @param hash - 交易哈希（0x 开头 64 字符）
 * @returns 脱敏后的哈希字符串，如 0x12345678...90abcdef
 */
export function formatTxHash(hash: string | null | undefined): string {
  if (!hash) return '';
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * Unix 时间戳格式化（秒级 → 本地时间字符串）
 * 
 * @param timestamp - Unix 秒级时间戳
 * @param locale - 语言区域（默认 zh-CN）
 * @param options - Intl.DateTimeFormatOptions
 * @returns 格式化后的时间字符串
 * 
 * @example
 * formatTimestamp(1700000000)
 * // => '2023/11/15 00:00:00'
 */
export function formatTimestamp(
  timestamp: number | bigint | null | undefined,
  locale: string = 'zh-CN',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (timestamp === null || timestamp === undefined) return '';
  
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000); // 秒 → 毫秒
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  
  return date.toLocaleString(locale, options || defaultOptions);
}

/**
 * 短时间格式化（仅月日时分）
 * 
 * @param timestamp - Unix 秒级时间戳
 * @returns 格式化后的短时间字符串，如 11/15 00:00
 */
export function formatShortTime(
  timestamp: number | bigint | null | undefined,
  locale: string = 'zh-CN',
): string {
  if (timestamp === null || timestamp === undefined) return '';
  
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 日期格式化（仅年月日）
 * 
 * @param timestamp - Unix 秒级时间戳
 * @returns 格式化后的日期字符串，如 2023年11月15日
 */
export function formatDate(
  timestamp: number | bigint | null | undefined,
  locale: string = 'zh-CN',
): string {
  if (timestamp === null || timestamp === undefined) return '';
  
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 数字格式化（带千分位）
 * 
 * @param value - 数字或字符串
 * @param decimals - 小数位数（默认 2）
 * @returns 格式化后的数字字符串，如 1,234.56
 */
export function formatNumber(
  value: number | string | bigint | null | undefined,
  decimals: number = 2,
): string {
  if (value === null || value === undefined) return '0';
  
  const num = typeof value === 'bigint' 
    ? Number(value) 
    : typeof value === 'string' 
      ? parseFloat(value) 
      : value;
  
  if (isNaN(num)) return '0';
  
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 金额格式化（ETH 单位）
 * 
 * @param wei - Wei 单位的金额（字符串或 bigint）
 * @param decimals - 小数位数（默认 4）
 * @returns 格式化后的 ETH 金额
 */
export function formatEth(
  wei: string | bigint | null | undefined,
  decimals: number = 4,
): string {
  if (wei === null || wei === undefined) return '0 ETH';
  
  const weiNum = typeof wei === 'bigint' ? Number(wei) : parseFloat(wei);
  const eth = weiNum / 1e18;
  
  return `${formatNumber(eth, decimals)} ETH`;
}

/**
 * 耗时格式化（毫秒 → 秒）
 * 
 * @param ms - 毫秒数
 * @returns 格式化后的耗时字符串，如 2.35s
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * 文件大小格式化（字节 → KB/MB/GB）
 * 
 * @param bytes - 文件大小（字节）
 * @returns 格式化后的文件大小，如 1.23 MB
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 百分比格式化
 * 
 * @param value - 小数形式的百分比（0.5 表示 50%）
 * @param decimals - 小数位数（默认 1）
 * @returns 格式化后的百分比字符串，如 50.0%
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 1,
): string {
  if (value === null || value === undefined) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
}
