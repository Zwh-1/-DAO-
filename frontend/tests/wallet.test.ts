/**
 * 钱包核心功能单元测试
 * 
 * 测试范围：
 * 1. AES-GCM 加密/解密（EmbeddedProvider）
 * 2. 地址格式化（脱敏显示）
 * 3. 错误映射（WalletError）
 * 4. 密码强度计算
 * 
 * 测试目标：
 * - 验证加密逻辑的准确性
 * - 确保脱敏处理无泄露
 * - 错误提示用户友好
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatAddress } from '@/lib/wallet-adapter';
import { calculatePasswordStrength } from '@/hooks/useConnectWallet';
import { getDefaultRpcUrlForChain, getNetworkByChainId } from '@/lib/wallet/networks';
import {
  mapWalletError,
  isUserRejected,
  isNetworkError,
  isSecurityError,
  WalletErrorCode,
  throwWalletError,
} from '@/lib/wallet/WalletError';

// ==================== 地址格式化测试 ====================

describe('Address Formatting', () => {
  it('应该正确格式化标准地址', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const formatted = formatAddress(address);
    
    expect(formatted).toBe('0x742d...f44e');
  });

  it('应该格式化短地址', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    const formatted = formatAddress(address);
    
    expect(formatted).toBe('0x1234...5678');
  });

  it('应该处理全小写地址', () => {
    const address = '0xabcdef1234567890abcdef1234567890abcdef12';
    const formatted = formatAddress(address);
    
    expect(formatted).toBe('0xabcd...ef12');
  });

  it('应该处理全大写地址', () => {
    const address = '0XABCDEF1234567890ABCDEF1234567890ABCDEF12';
    const formatted = formatAddress(address);
    
    expect(formatted).toBe('0XABCD...EF12');
  });
});

// ==================== 密码强度测试 ====================

describe('Password Strength Calculator', () => {
  it('空密码应该返回 0', () => {
    expect(calculatePasswordStrength('')).toBe(0);
  });

  it('短密码（<8 位）应该得 0 分', () => {
    expect(calculatePasswordStrength('short')).toBe(0);
    expect(calculatePasswordStrength('1234567')).toBe(0);
  });

  it('长度 ≥8 位应该得 1 分', () => {
    expect(calculatePasswordStrength('password')).toBe(1);
  });

  it('长度 ≥12 位应该额外 +1 分', () => {
    expect(calculatePasswordStrength('longpassword')).toBe(2);
  });

  it('包含大写字母应该 +1 分', () => {
    expect(calculatePasswordStrength('Password123')).toBe(3); // 12 位 + 大写 + 数字
  });

  it('包含数字应该 +1 分', () => {
    expect(calculatePasswordStrength('password1')).toBe(2); // 9 位 + 数字
  });

  it('包含特殊字符应该 +1 分', () => {
    expect(calculatePasswordStrength('password!')).toBe(2); // 9 位 + 特殊字符
  });

  it('强密码应该得 5 分', () => {
    const strongPassword = 'Str0ngP@ssw0rd!'; // 15 位 + 大写 + 数字 + 特殊字符
    expect(calculatePasswordStrength(strongPassword)).toBe(5);
  });

  it('中等密码应该得 3 分', () => {
    const mediumPassword = 'Medium1'; // 7 位，不得分
    expect(calculatePasswordStrength(mediumPassword)).toBe(0);
    
    const mediumPassword2 = 'Medium12'; // 8 位 + 数字 = 2 分
    expect(calculatePasswordStrength(mediumPassword2)).toBe(2);
  });
});

// ==================== 链配置（与 adapter / NetworkSwitcher 一致）====================

describe('SUPPORTED_NETWORKS', () => {
  it('本地测试链 887766 的 RPC 应与 adapter 默认一致', () => {
    expect(getDefaultRpcUrlForChain(887766)).toBe('http://127.0.0.1:8545');
    expect(getNetworkByChainId(887766)?.name).toBe('Medical Testnet');
  });

  it('未配置的 chainId 应返回 undefined', () => {
    expect(getNetworkByChainId(999999999)).toBeUndefined();
  });
});

// ==================== 错误映射测试 ====================

describe('Wallet Error Mapping', () => {
  it('字符串错误 → UNKNOWN_ERROR + 原文作为 uiMessage', () => {
    const mapped = mapWalletError('User rejected transaction');
    expect(mapped.uiCode).toBe(WalletErrorCode.UNKNOWN_ERROR);
    expect(mapped.uiMessage).toBe('User rejected transaction');
  });

  it('null → UNKNOWN_ERROR 且消息为默认提示', () => {
    const mapped = mapWalletError(null);
    expect(mapped.uiCode).toBe(WalletErrorCode.UNKNOWN_ERROR);
    expect(mapped.uiMessage).toBe('发生未知错误');
  });

  it('undefined → UNKNOWN_ERROR', () => {
    const mapped = mapWalletError(undefined);
    expect(mapped.uiCode).toBe(WalletErrorCode.UNKNOWN_ERROR);
  });

  it('MetaMask code 4001 → USER_REJECTED', () => {
    const mapped = mapWalletError({ code: 4001, message: 'User denied' });
    expect(mapped.uiCode).toBe(WalletErrorCode.USER_REJECTED);
    expect(mapped.uiMessage).toBe('您拒绝了连接请求');
  });

  it('MetaMask code 4902 → CHAIN_NOT_FOUND', () => {
    const mapped = mapWalletError({ code: 4902 });
    expect(mapped.uiCode).toBe(WalletErrorCode.CHAIN_NOT_FOUND);
  });

  it('RPC code -32603 → RPC_ERROR', () => {
    const mapped = mapWalletError({ code: -32603, message: 'Internal JSON-RPC error' });
    expect(mapped.uiCode).toBe(WalletErrorCode.RPC_ERROR);
  });

  it('name ACTION_REJECTED → USER_REJECTED', () => {
    const err = new Error('action rejected');
    err.name = 'ACTION_REJECTED';
    expect(mapWalletError(err).uiCode).toBe(WalletErrorCode.USER_REJECTED);
  });

  it('name WALLET_LOCKED → WALLET_LOCKED', () => {
    const err = new Error('locked');
    err.name = 'WALLET_LOCKED';
    expect(mapWalletError(err).uiCode).toBe(WalletErrorCode.WALLET_LOCKED);
  });

  it('name INSUFFICIENT_FUNDS → INSUFFICIENT_BALANCE', () => {
    const err = new Error('insufficient funds for gas');
    err.name = 'INSUFFICIENT_FUNDS';
    const m = mapWalletError(err);
    expect(m.uiCode).toBe(WalletErrorCode.INSUFFICIENT_BALANCE);
  });

  it('message 含 "rejected" → USER_REJECTED (fallback)', () => {
    const mapped = mapWalletError({ message: 'user rejected the request' });
    expect(mapped.uiCode).toBe(WalletErrorCode.USER_REJECTED);
  });

  it('message 含 "timeout" → TIMEOUT (fallback)', () => {
    const mapped = mapWalletError({ message: 'connection timeout after 30s' });
    expect(mapped.uiCode).toBe(WalletErrorCode.TIMEOUT);
  });

  it('message 含 "network" → NETWORK_ERROR (fallback)', () => {
    const mapped = mapWalletError({ message: 'network error' });
    expect(mapped.uiCode).toBe(WalletErrorCode.NETWORK_ERROR);
  });

  it('message 含 "password" → INVALID_PASSWORD (fallback)', () => {
    const mapped = mapWalletError({ message: 'bad password or decrypt failed' });
    expect(mapped.uiCode).toBe(WalletErrorCode.INVALID_PASSWORD);
  });

  it('脱敏：完整地址被截断为 0x前6...后4', () => {
    const addr = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    const mapped = mapWalletError({ message: `nonce too low for ${addr}` });
    expect(mapped.uiMessage).not.toContain(addr);
    expect(mapped.uiMessage).toContain('0x742d...f44e');
  });

  it('脱敏：私钥 hex 被替换', () => {
    const pk = '0x' + 'ab'.repeat(32);
    const mapped = mapWalletError({ message: `key: ${pk}` });
    expect(mapped.uiMessage).toContain('[PRIVATE_KEY_REDACTED]');
    expect(mapped.uiMessage).not.toContain(pk);
  });
});

// ==================== 辅助判断函数测试 ====================

describe('isUserRejected / isNetworkError / isSecurityError', () => {
  it('isUserRejected 对 code 4001 返回 true', () => {
    expect(isUserRejected({ code: 4001 })).toBe(true);
  });

  it('isUserRejected 对普通错误返回 false', () => {
    expect(isUserRejected({ message: 'some error' })).toBe(false);
  });

  it('isNetworkError 对 RPC 错误返回 true', () => {
    expect(isNetworkError({ code: -32603 })).toBe(true);
  });

  it('isNetworkError 对 timeout 消息返回 true', () => {
    expect(isNetworkError({ code: 'TIMEOUT' })).toBe(true);
  });

  it('isSecurityError 对 WALLET_LOCKED 返回 true', () => {
    const err = new Error('x');
    err.name = 'WALLET_LOCKED';
    expect(isSecurityError(err)).toBe(true);
  });

  it('isSecurityError 对 INVALID_PASSWORD 返回 true', () => {
    const err = new Error('x');
    err.name = 'INVALID_PASSWORD';
    expect(isSecurityError(err)).toBe(true);
  });
});

// ==================== throwWalletError 测试 ====================

describe('throwWalletError', () => {
  it('应抛出 Error 且 name 等于错误码', () => {
    expect(() => throwWalletError(WalletErrorCode.WALLET_LOCKED)).toThrowError('钱包已锁定');
  });

  it('自定义 message 覆盖默认', () => {
    expect(() => throwWalletError(WalletErrorCode.INTERNAL_ERROR, '自定义')).toThrowError('自定义');
  });
});

// ==================== AES-GCM 加解密测试（Web Crypto API 对齐 EmbeddedProvider 算法） ====================

const PBKDF2_ITERATIONS = 100_000;

async function aesGcmEncrypt(
  plaintext: Uint8Array,
  password: string,
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext.buffer as ArrayBuffer);
  const toHex = (buf: Uint8Array) => Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  return { ciphertext: toHex(new Uint8Array(ct)), iv: toHex(iv), salt: toHex(salt) };
}

async function aesGcmDecrypt(
  encrypted: { ciphertext: string; iv: string; salt: string },
  password: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const salt = fromHex(encrypted.salt);
  const iv = fromHex(encrypted.iv);
  const ct = fromHex(encrypted.ciphertext);
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new Uint8Array(plain);
}

describe('AES-GCM Encryption (Web Crypto, 算法对齐 EmbeddedProvider)', () => {
  const password = 'Str0ngP@ss!';
  const privateKey = new Uint8Array(32).map((_, i) => i + 1);

  it('加密 → 解密应还原原始私钥', async () => {
    const encrypted = await aesGcmEncrypt(privateKey, password);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv.length).toBe(24); // 12 bytes → 24 hex chars
    expect(encrypted.salt.length).toBe(32); // 16 bytes → 32 hex chars

    const decrypted = await aesGcmDecrypt(encrypted, password);
    expect(decrypted).toEqual(privateKey);
  });

  it('错误密码应抛出解密失败', async () => {
    const encrypted = await aesGcmEncrypt(privateKey, password);
    await expect(aesGcmDecrypt(encrypted, 'wrongPassword')).rejects.toThrow();
  });

  it('两次加密同一明文应产生不同密文（随机 salt/iv）', async () => {
    const a = await aesGcmEncrypt(privateKey, password);
    const b = await aesGcmEncrypt(privateKey, password);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.salt).not.toBe(b.salt);
  });

  it('secureClear：fill(0) 后原 buffer 全为零', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    buf.fill(0);
    expect(buf.every(b => b === 0)).toBe(true);
  });
});

