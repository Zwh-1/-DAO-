/**
 * 钱包连接 Hook（基于 @trustaid/wallet-sdk）
 * 
 * 功能：
 * - 管理钱包连接状态
 * - 提供连接/断开方法
 * - 自动重连机制
 * - 连接超时控制
 * 
 * 隐私保护：
 * - 不存储私钥
 * - 日志地址脱敏
 * - 支持用户拒绝授权
 */

'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  requestPrimaryAccount,
  disconnectWallet,
  switchNetwork as switchNetworkUtil,
  mapWalletError,
  isUserRejected,
  isNetworkError,
  formatAddress as formatAddressUtil
} from '../lib/wallet/wallet-adapter';

// ==================== 类型定义 ====================

/**
 * 钱包连接状态
 */
interface WalletState {
  /** 钱包地址 */
  address: string | null;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在连接 */
  isConnecting: boolean;
  /** 连接错误 */
  error: string | null;
  /** 错误码 */
  errorCode: string | null;
  /** 链 ID */
  chainId?: number | null;
  /** 钱包运行时 */
  runtime: "injected" | "embedded" | null;
}

/**
 * 钱包操作接口
 */
interface WalletActions {
  /** 连接钱包 */
  connect: () => Promise<void>;
  /** 断开连接 */
  disconnect: () => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
  /** 重试连接 */
  retry: () => Promise<void>;
  /** 格式化地址 */
  formatAddress: () => string;
  /** 切换网络 */
  switchNetwork: (chainId: number) => Promise<void>;
}

/**
 * 钱包 Hook 返回值
 */
export type WalletReturn = WalletState & WalletActions;

/**
 * 连接超时配置（毫秒）
 */
const CONNECT_TIMEOUT_MS = 30000; // 30 秒

/**
 * 自动重连间隔（毫秒）
 */
const RECONNECT_INTERVAL_MS = 5000; // 5 秒

/**
 * 最大重试次数
 */
const MAX_RETRY_COUNT = 3;

/**
 * 钱包连接 Hook（基于 wallet-sdk）
 * 
 * @returns 钱包状态和操作
 */
export function useWallet(): WalletReturn {
  // ==================== 状态管理 ====================
  
  // 从全局 store 读取状态
  const address = useAuthStore((state) => state.address);
  const isConnecting = useAuthStore((state) => state.isWalletConnecting());
  const error = useAuthStore((state) => state.error);
  const walletChainId = useAuthStore((state) => state.walletChainId);
  const walletRuntime = useAuthStore((state) => state.walletRuntime);
  
  // 派生状态：是否已连接
  const isConnected = useAuthStore((state) => state.isWalletConnected());
  
  // 获取 actions
  const setWalletSessionState = useAuthStore((state) => state.setWalletSessionState);
  const setAddress = useAuthStore((state) => state.setAddress);
  const setWalletError = useAuthStore((state) => state.setWalletError);
  const setWalletChainId = useAuthStore((state) => state.setWalletChainId);
  
  // 本地错误状态
  const [localError, setLocalError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // 引用（重连定时器仅用于 connect() 失败重试，钱包事件订阅由 wallet-adapter 单例统一处理）
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // ==================== 工具函数 ====================
  
  /**
   * 格式化地址
   */
  const formatAddress = useCallback(() => {
    return formatAddressUtil(address);
  }, [address]);

  /**
   * 清除所有定时器
   */
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearInterval(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setWalletError(null);
    setLocalError(null);
    setRetryCount(0);
  }, [setWalletError]);

  // ==================== 连接逻辑 ====================
  
  /**
   * 处理断开连接
   */
  const handleDisconnect = useCallback(() => {
    setWalletSessionState("locked");
    setAddress(null);
    setWalletChainId(null);
    clearTimers();
  }, [setAddress, setWalletSessionState, setWalletChainId, clearTimers]);

  /**
   * 连接钱包
   */
  const connect = useCallback(async () => {
    // 防止重复连接
    if (isConnectingRef.current) {
      console.warn('[useWallet] 正在连接中，请稍候...');
      return;
    }

    isConnectingRef.current = true;
    clearError();
    setWalletSessionState('connecting');

    // 设置连接超时
    connectTimeoutRef.current = setTimeout(() => {
      const timeoutError = new Error('连接超时，请检查网络或钱包插件');
      const mappedError = mapWalletError({ code: 'TIMEOUT', message: timeoutError.message });
      setWalletError(mappedError.message, mappedError.uiCode);
      setLocalError(mappedError.message);
      setWalletSessionState('failed');
      isConnectingRef.current = false;
    }, CONNECT_TIMEOUT_MS);

    try {
      // 请求主账户
      const addr = await requestPrimaryAccount();
      
      // 连接成功，清除定时器
      clearTimers();
      setRetryCount(0);
      
      console.log('[useWallet] 连接成功:', formatAddressUtil(addr));
    } catch (err) {
      // 清除超时定时器
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }

      // 映射错误
      const mappedError = mapWalletError(err);
      const errorMessage = mappedError.message;
      const errorCode = mappedError.uiCode;

      console.error('[useWallet] 连接失败:', errorMessage);

      // 用户拒绝不记录错误
      if (!isUserRejected(err)) {
        setWalletError(errorMessage, errorCode);
        setLocalError(errorMessage);
      }

      // 网络错误可以尝试重连
      if (isNetworkError(err) && retryCount < MAX_RETRY_COUNT) {
        console.log('[useWallet] 网络错误，准备重试...');
        reconnectTimerRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          connect();
        }, RECONNECT_INTERVAL_MS);
      } else {
        setWalletSessionState('failed');
      }

      // 抛出错误让调用者处理
      throw mappedError;
    } finally {
      isConnectingRef.current = false;
    }
  }, [clearError, setWalletError, setWalletSessionState, clearTimers, retryCount]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet();
      handleDisconnect();
      clearTimers();
      setRetryCount(MAX_RETRY_COUNT); // 停止自动重连
      console.log('[useWallet] 已断开连接');
    } catch (err) {
      console.error('[useWallet] 断开失败:', err);
    }
  }, [handleDisconnect, clearTimers]);

  /**
   * 重试连接
   */
  const retry = useCallback(async () => {
    if (isConnectingRef.current) return;
    setRetryCount(0);
    await connect();
  }, [connect]);

  /**
   * 切换网络
   */
  const switchNetwork = useCallback(async (chainId: number) => {
    try {
      await switchNetworkUtil(chainId);
      console.log('[useWallet] 网络切换成功:', chainId);
    } catch (error) {
      console.error('[useWallet] 网络切换失败:', error);
      throw error;
    }
  }, []);

  // ==================== 清理 ====================
  
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // ==================== 返回值 ====================
  
  return {
    // 状态
    address: address || null,
    isConnected: isConnected && !!address,
    isConnecting,
    error: localError || error,
    errorCode: localError ? mapWalletError(localError).uiCode : null,
    chainId: walletChainId,
    runtime: walletRuntime,
    // 操作
    connect,
    disconnect,
    clearError,
    retry,
    formatAddress,
    switchNetwork,
  };
}

/**
 * 钱包地址格式化（脱敏展示）
 * @param address - 钱包地址
 * @returns 格式化后的地址
 */
export function formatAddress(address: string | null): string {
  return formatAddressUtil(address);
}

/**
 * 钱包地址完整展示（仅用于调试）
 * @warning 生产环境禁止使用此函数
 */
export function formatAddressFull(address: string | null): string {
  if (!address) return '未连接';
  console.warn('[Security] formatAddressFull 仅用于调试，生产环境禁用');
  return address;
}
