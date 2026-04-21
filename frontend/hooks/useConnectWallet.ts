/**
 * 钱包连接管理 Hook（增强版）
 * 
 * 设计目标：
 * 1. 将 ConnectWalletModal 中的连接逻辑全部抽离至此
 * 2. 统一处理 MetaMask、Embedded、WalletConnect 三种模式
 * 3. 提供状态机驱动的连接流程
 * 4. 支持 Framer Motion 动效所需的状态数据
 * 
 * @returns 连接状态、操作函数、错误处理
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSIWE } from './useSIWE';
import {
  setWalletMode,
  setEmbeddedWalletConfig,
  getWalletClient,
  createOrImportEmbeddedWallet,
  resetExternalWalletProvider,
  setWalletProviderResolver,
} from '@/lib/wallet-adapter';
import { openWalletConnectSession } from '@/lib/wallet/walletconnect-session';
import { mapWalletError, WalletErrorCode } from '@/lib/wallet/WalletError';

// ==================== 类型定义 ====================

/**
 * 钱包模式
 */
type WalletMode = 'auto' | 'injected' | 'embedded';

/**
 * 钱包类型
 */
export type WalletType = 'metamask' | 'embedded' | 'walletconnect';

/**
 * 内置钱包阶段状态
 */
export type EmbeddedStage =
  | { stage: 'form' } // 显示表单
  /** 新建成功：展示助记词备份后再进入 ready */
  | { stage: 'mnemonic_backup'; address: string; mnemonic: string }
  | { stage: 'ready'; address: string } // 准备就绪，等待 SIWE
  | { stage: 'siwe_error'; address: string; msg: string }; // SIWE 失败

/**
 * 密码强度等级（0-5）
 */
export type PasswordStrength = number;

/**
 * Hook 返回值类型
 */
interface UseConnectWalletReturn {
  // 状态
  selectedWallet: WalletType | null;
  embeddedStage: EmbeddedStage;
  embeddedTab: 'unlock' | 'create' | 'import';
  password: string;
  mnemonic: string;
  showPassword: boolean;
  passwordStrength: PasswordStrength;
  isBusy: boolean;
  error: string | null;
  errorCode: string | null;

  // 操作
  selectWallet: (wallet: WalletType | null) => void;
  setPassword: (password: string) => void;
  setMnemonic: (mnemonic: string) => void;
  togglePasswordVisibility: () => void;
  setEmbeddedTab: (tab: 'unlock' | 'create' | 'import') => void;
  setEmbeddedStage: (stage: EmbeddedStage) => void;
  
  // 连接动作
  connectMetaMask: () => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  setupEmbeddedWallet: () => Promise<void>;
  completeEmbeddedSignIn: () => Promise<void>;
  /** 新建钱包：确认已备份助记词后进入签名前阶段 */
  confirmMnemonicBackedUp: () => void;

  // 错误处理
  clearError: () => void;
  resetFlow: () => void;
}

// ==================== 密码强度计算 ====================

/**
 * 计算密码强度（0-5 分）
 * 
 * 评分规则：
 * - 长度 ≥ 8: +1
 * - 长度 ≥ 12: +1
 * - 包含大写字母：+1
 * - 包含数字：+1
 * - 包含特殊字符：+1
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  return strength;
}

// ==================== 错误映射 ====================

/**
 * 将错误映射为用户友好的提示
 */
function mapEmbeddedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('password')) {
    return '密码错误，请重新输入';
  }
  if (message.includes('mnemonic')) {
    return '助记词无效，请检查单词拼写及顺序';
  }
  if (message.includes('network') || message.includes('RPC')) {
    return '无法连接到区块链服务，请检查网络';
  }
  if (message.includes('locked')) {
    return '钱包已锁定，请输入密码解锁';
  }
  if (message.includes('not found') || message.includes('empty')) {
    return '未找到本地账户，请尝试新建或导入';
  }
  
  return message;
}

// ==================== 主 Hook ====================

/**
 * 钱包连接管理 Hook
 * 
 * 使用示例：
 * ```tsx
 * const {
 *   selectedWallet,
 *   embeddedStage,
 *   password,
 *   isBusy,
 *   error,
 *   selectWallet,
 *   connectMetaMask,
 *   setupEmbeddedWallet,
 *   clearError
 * } = useConnectWallet();
 * ```
 */
export function useConnectWallet(): UseConnectWalletReturn {
  // ==================== 本地状态 ====================
  
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [embeddedStage, setEmbeddedStage] = useState<EmbeddedStage>({ stage: 'form' });
  const [embeddedTab, setEmbeddedTab] = useState<'unlock' | 'create' | 'import'>('unlock');
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // 从全局 Store 读取状态
  const storeError = useAuthStore((state) => state.error);
  const storeErrorCode = useAuthStore((state) => state.errorCode);
  const isConnecting = useAuthStore((state) => state.isWalletConnecting());
  
  // SIWE Hook
  const { signIn, busy: siweBusy } = useSIWE();
  
  // 计算密码强度
  const passwordStrength = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );
  
  // 合并忙碌状态
  const isBusy = isConnecting || siweBusy;
  
  // 使用全局错误（优先）或本地错误
  const error = storeError;
  const errorCode = storeErrorCode;
  
  // ==================== Actions ====================
  
  /**
   * 选择钱包类型
   */
  const selectWallet = useCallback((wallet: WalletType | null) => {
    setSelectedWallet(wallet);
    setEmbeddedStage({ stage: 'form' });
    setPassword('');
    setMnemonic('');
    setShowPassword(false);
  }, []);
  
  /**
   * 切换内置钱包 Tab
   */
  const handleSetEmbeddedTab = useCallback((tab: 'unlock' | 'create' | 'import') => {
    setEmbeddedTab(tab);
    setEmbeddedStage({ stage: 'form' });
    setPassword('');
    setMnemonic('');
  }, []);
  
  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    // 清除全局错误
    const { clearWalletError } = useAuthStore.getState();
    clearWalletError();
  }, []);
  
  /**
   * 重置整个连接流程
   */
  const resetFlow = useCallback(() => {
    setSelectedWallet(null);
    setEmbeddedStage({ stage: 'form' });
    setEmbeddedTab('unlock');
    setPassword('');
    setMnemonic('');
    setShowPassword(false);
    clearError();
  }, [clearError]);
  
  /**
   * 连接 MetaMask
   * 
   * 流程：
   * 1. 设置钱包模式为 injected
   * 2. 调用 SIWE 签名
   * 3. 成功则关闭弹窗
   */
  const connectMetaMask = useCallback(async () => {
    clearError();

    try {
      await resetExternalWalletProvider();
      setWalletMode('injected');
      useAuthStore.getState().setWalletConnector('injected');

      await signIn();

      console.log('[useConnectWallet] MetaMask 连接成功');
    } catch (err) {
      const mapped = mapWalletError(err);
      const { setWalletError } = useAuthStore.getState();
      setWalletError(mapped.uiMessage, mapped.uiCode);
      throw err;
    }
  }, [signIn, clearError]);

  /**
   * WalletConnect：EIP-1193 经 providerResolver 接入 wallet-sdk，再走 SIWE。
   */
  const connectWalletConnect = useCallback(async () => {
    clearError();

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
    if (!projectId) {
      useAuthStore.getState().setWalletError(
        '请配置环境变量 NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID（WalletConnect Cloud Project ID）',
        'INVALID_PARAMS'
      );
      return;
    }

    try {
      await resetExternalWalletProvider();
      const provider = await openWalletConnectSession(projectId);
      setWalletProviderResolver(() => provider);
      setWalletMode('injected');
      useAuthStore.getState().setWalletConnector('walletconnect');

      await signIn();

      console.log('[useConnectWallet] WalletConnect 连接成功');
    } catch (err) {
      const mapped = mapWalletError(err);
      const { setWalletError } = useAuthStore.getState();
      setWalletError(mapped.uiMessage, mapped.uiCode);
      throw err;
    }
  }, [signIn, clearError]);
  
  /**
   * 设置内置钱包
   * 
   * 流程：
   * 1. 验证密码
   * 2. 设置钱包模式为 embedded
   * 3. 解锁/创建/导入钱包
   * 4. 进入 ready 状态，等待 SIWE
   */
  const setupEmbeddedWallet = useCallback(async () => {
    if (!password) {
      const { setWalletError } = useAuthStore.getState();
      setWalletError('请输入密码', WalletErrorCode.INVALID_PASSWORD);
      return;
    }
    
    clearError();

    try {
      await resetExternalWalletProvider();
      setWalletMode('embedded');

      const rpcUrl =
        process.env.NEXT_PUBLIC_RPC_URL?.trim() || 'http://127.0.0.1:8545';

      setEmbeddedWalletConfig({
        password,
        rpcUrl,
      });
      
      const client = getWalletClient();
      if (!client) {
        throw new Error('钱包客户端未初始化');
      }
      
      useAuthStore.getState().setWalletConnector('embedded');

      if (embeddedTab === 'unlock') {
        const accounts = await client.listEmbeddedAccounts(password);
        if (!accounts || accounts.length === 0) {
          throw new Error('未找到本地账户，请尝试新建或导入');
        }
        const address = String(accounts[0]);
        setEmbeddedStage({ stage: 'ready', address });
        console.log('[useConnectWallet] 内置钱包解锁成功:', address);
      } else if (embeddedTab === 'import') {
        if (!mnemonic.trim()) {
          throw new Error('请输入助记词');
        }
        const result = await createOrImportEmbeddedWallet({
          password,
          mnemonic: mnemonic.trim(),
        });
        setEmbeddedStage({ stage: 'ready', address: result.address });
        console.log('[useConnectWallet] 内置钱包导入成功:', result.address);
      } else {
        const result = await createOrImportEmbeddedWallet({ password });
        if (result.mode !== "create") {
          throw new Error("unexpected embedded create result");
        }
        setEmbeddedStage({
          stage: "mnemonic_backup",
          address: result.address,
          mnemonic: result.mnemonic,
        });
        console.log("[useConnectWallet] 内置钱包已创建，等待备份助记词:", result.address);
      }
    } catch (err) {
      const mapped = mapWalletError(err);
      const { setWalletError } = useAuthStore.getState();
      setWalletError(mapped.uiMessage, mapped.uiCode);
      throw err;
    }
  }, [password, embeddedTab, mnemonic, clearError]);
  
  /**
   * 完成内置钱包登录（SIWE 签名）
   * 
   * 流程：
   * 1. 调用 SIWE 签名
   * 2. 成功则关闭弹窗
   * 3. 失败则进入 siwe_error 状态
   */
  const confirmMnemonicBackedUp = useCallback(() => {
    setEmbeddedStage((prev) => {
      if (prev.stage !== 'mnemonic_backup') return prev;
      return { stage: 'ready', address: prev.address };
    });
  }, []);

  const completeEmbeddedSignIn = useCallback(async () => {
    clearError();
    
    try {
      await signIn();
      console.log('[useConnectWallet] 内置钱包 SIWE 签名成功');
    } catch (err) {
      const msg = mapEmbeddedError(err);
      const addr = embeddedStage.stage !== 'form' 
        ? (embeddedStage as any).address 
        : '';
      
      setEmbeddedStage({
        stage: 'siwe_error',
        address: addr,
        msg,
      });
      
      throw err;
    }
  }, [signIn, clearError, embeddedStage]);
  
  /**
   * 切换密码显示/隐藏
   */
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  // ==================== 副作用处理 ====================
  
  /**
   * 快捷键与焦点管理
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetFlow();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [resetFlow]);
  
  // ==================== 返回值 ====================
  
  return {
    // 状态
    selectedWallet,
    embeddedStage,
    embeddedTab,
    password,
    mnemonic,
    showPassword,
    passwordStrength,
    isBusy,
    error,
    errorCode,
    
    // 操作
    selectWallet,
    setPassword,
    setMnemonic,
    togglePasswordVisibility,
    setEmbeddedTab: handleSetEmbeddedTab,
    setEmbeddedStage,
    
    // 连接动作
    connectMetaMask,
    connectWalletConnect,
    setupEmbeddedWallet,
    completeEmbeddedSignIn,
    confirmMnemonicBackedUp,

    // 错误处理
    clearError,
    resetFlow,
  };
}
