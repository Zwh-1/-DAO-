/**
 * wagmi Provider 组件 - 使用 @trustaid/wallet-sdk 替代
 * 
 * 功能：
 * - 提供 wallet-sdk 上下文
 * - 避免 SSR 时访问 indexedDB
 * - 支持注入钱包和内置钱包
 * - 添加初始化进度和错误边界
 * 
 * 使用方式：
 * ```tsx
 * <WalletProviders>
 *   <App />
 * </WalletProviders>
 * ```
 */

'use client';

import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import { getWalletClient, setWalletApprovalHandler } from "@/lib/wallet/wallet-adapter";
import { useAuthStore } from "@/store/authStore";
import { useWalletApprovalStore } from "@/store/walletApprovalStore";
import WalletConfirmDialog from "@/components/ui/WalletConfirmDialog";

// ==================== 类型定义 ====================

/**
 * wagmi Provider 属性
 */
interface WalletProvidersProps {
  children: ReactNode;
}

/**
 * 初始化状态
 */
type InitStatus = 'idle' | 'initializing' | 'ready' | 'error';

/**
 * wagmi Provider 组件
 */
export function Providers({ children }: WalletProvidersProps) {
  // ==================== 状态管理 ====================
  
  const [status, setStatus] = useState<InitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const setWalletRuntime = useAuthStore((state) => state.setWalletRuntime);
  const setAddress = useAuthStore((state) => state.setAddress);
  const setWalletSessionState = useAuthStore((state) => state.setWalletSessionState);

  // ==================== 初始化逻辑 ====================
  
  /**
   * 初始化钱包客户端
   */
  const initializeWallet = useCallback(async () => {
    // 只在客户端初始化
    if (typeof window === 'undefined') {
      setStatus('ready');
      return;
    }

    try {
      setStatus('initializing');
      setError(null);

      // 获取钱包客户端
      const client = getWalletClient();
      
      if (!client) {
        throw new Error('钱包客户端初始化失败');
      }

      const runtime = client.getRuntimeInfo().runtime;
      
      // 更新全局状态
      setWalletRuntime(runtime);
      
      // 尝试恢复会话
      try {
        // 检查是否有已保存的账户
        if (runtime === 'embedded') {
          // embedded 模式需要密码，跳过自动恢复
          console.log('[WalletProviders] embedded 模式，需要手动解锁');
          setWalletSessionState('locked');
        } else {
          // injected 模式尝试获取账户
          try {
            const accounts = await client.requestAccounts() || [];
            if (accounts && accounts.length > 0) {
              const addr = String(accounts[0]).toLowerCase();
              setAddress(addr);
              setWalletSessionState('unlocked');
              console.log('[WalletProviders] 恢复会话成功:', addr.slice(0, 6) + '...');
            } else {
              setWalletSessionState('idle');
            }
          } catch (requestError) {
            // 用户拒绝或其他错误
            console.warn('[WalletProviders] 请求账户失败:', requestError);
            setWalletSessionState('idle');
          }
        }
      } catch (restoreError) {
        console.warn('[WalletProviders] 恢复会话失败:', restoreError);
        setWalletSessionState('idle');
      }

      // embedded 模式注册审批弹框处理器（injected 由 MetaMask 原生弹框处理）
      if (runtime === 'embedded') {
        const { show } = useWalletApprovalStore.getState();
        setWalletApprovalHandler(show);
      }

      setStatus('ready');
      console.log('[WalletProviders] 初始化成功，模式:', runtime);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '初始化失败';
      console.error('[WalletProviders] 初始化失败:', errorMessage);
      setError(errorMessage);
      setStatus('error');
      // 即使失败也继续渲染，让子组件处理错误
    }
  }, [setWalletRuntime, setAddress, setWalletSessionState]);

  // ==================== 生命周期 ====================
  
  useEffect(() => {
    initializeWallet();
  }, [initializeWallet]);

  // ==================== 渲染 ====================
  
  // SSR 时或初始化时直接渲染子组件
  // 错误时也继续渲染，让子组件通过 useWallet 获取错误状态
  return (
    <>
      {children}
      <WalletConfirmDialog />
    </>
  );
}

/**
 * 导出默认 Provider
 */
export default Providers;
