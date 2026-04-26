/**
 * 钱包错误提示组件
 * 
 * 功能：
 * - 显示友好的错误信息
 * - 提供解决建议
 * - 支持重试操作
 * 
 * 视觉规范：
 * - 医疗蓝配色，无蓝紫渐变
 * - 错误使用警示红
 * - 成功使用合规绿
 */

'use client';

import React from 'react';

// ==================== 类型定义 ====================

export type WalletErrorCode =
  | 'WALLET_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'UNSUPPORTED_METHOD'
  | 'USER_REJECTED'
  | 'CHAIN_NOT_ADDED'
  | 'CHAIN_SWITCH_REJECTED'
  | 'INVALID_PARAMS'
  | 'TX_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

interface WalletErrorDisplayProps {
  /** 错误代码 */
  errorCode: WalletErrorCode;
  /** 错误信息 */
  message?: string;
  /** 是否显示解决建议 */
  showSuggestion?: boolean;
  /** 重试处理 */
  onRetry?: () => void;
  /** 关闭处理 */
  onClose?: () => void;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
}

// ==================== 错误配置 ====================

const ERROR_CONFIG: Record<WalletErrorCode, {
  title: string;
  icon: string;
  color: string;
  suggestion: string;
  retryable: boolean;
}> = {
  WALLET_NOT_FOUND: {
    title: '未找到钱包',
    icon: '🦊',
    color: '#0A2540',
    suggestion: '请安装 MetaMask 浏览器插件或刷新页面重试',
    retryable: true,
  },
  INVALID_PASSWORD: {
    title: '密码错误',
    icon: '🔒',
    color: '#D93025',
    suggestion: '请检查钱包密码是否正确，注意大小写',
    retryable: true,
  },
  UNSUPPORTED_METHOD: {
    title: '不支持的操作',
    icon: '⚠️',
    color: '#0A2540',
    suggestion: '当前钱包不支持此操作，请尝试其他钱包',
    retryable: false,
  },
  USER_REJECTED: {
    title: '用户拒绝',
    icon: '❌',
    color: '#0A2540',
    suggestion: '您拒绝了钱包授权，如需继续请重新连接',
    retryable: true,
  },
  CHAIN_NOT_ADDED: {
    title: '网络未添加',
    icon: '🌐',
    color: '#0A2540',
    suggestion: '请在钱包中添加目标网络后重试',
    retryable: true,
  },
  CHAIN_SWITCH_REJECTED: {
    title: '拒绝切换网络',
    icon: '🔄',
    color: '#0A2540',
    suggestion: '您拒绝了网络切换请求',
    retryable: true,
  },
  INVALID_PARAMS: {
    title: '参数错误',
    icon: '⚙️',
    color: '#D93025',
    suggestion: '请求参数无效，请检查配置或联系支持',
    retryable: false,
  },
  TX_FAILED: {
    title: '交易失败',
    icon: '💸',
    color: '#D93025',
    suggestion: '交易执行失败，请检查 Gas 费或网络状态',
    retryable: true,
  },
  NETWORK_ERROR: {
    title: '网络错误',
    icon: '📡',
    color: '#D93025',
    suggestion: '网络连接不稳定，请检查网络后重试',
    retryable: true,
  },
  TIMEOUT: {
    title: '连接超时',
    icon: '⏱️',
    color: '#F59E0B',
    suggestion: '连接超时，请检查网络或钱包插件后重试',
    retryable: true,
  },
  UNKNOWN: {
    title: '未知错误',
    icon: '❓',
    color: '#0A2540',
    suggestion: '发生未知错误，请稍后重试或联系支持',
    retryable: true,
  },
};

// ==================== 主组件 ====================

export function WalletErrorDisplay({
  errorCode,
  message,
  showSuggestion = true,
  onRetry,
  onClose,
  size = 'md',
}: WalletErrorDisplayProps) {
  const config = ERROR_CONFIG[errorCode] || ERROR_CONFIG.UNKNOWN;

  // 尺寸映射
  const sizeClasses = {
    sm: 'p-3 text-xs',
    md: 'p-4 text-sm',
    lg: 'p-6 text-base',
  };

  const iconSize = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div
        className={`
          rounded-lg border-l-4 border-l-primary
          bg-white shadow-sm
          ${sizeClasses[size]}
        `}
        role="alert"
      >
        {/* 错误标题和图标 */}
        <div className="flex items-start gap-3 mb-2">
          <span className={iconSize[size]}>{config.icon}</span>
          <div className="flex-1">
            <div
              className="font-semibold mb-1 text-primary"
            >
              {config.title}
            </div>
          {message && (
            <div className="text-gray-600 text-xs mt-1">
              {message}
            </div>
          )}
        </div>
      </div>

      {/* 解决建议 */}
      {showSuggestion && (
        <div className="mt-3 p-3 rounded bg-gray-50">
          <div className="text-xs font-medium text-gray-700 mb-1">
            💡 解决建议：
          </div>
          <div className="text-gray-600 text-xs leading-relaxed">
            {config.suggestion}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-4">
        {config.retryable && onRetry && (
          <button
            className="px-4 py-2 text-sm font-medium text-white rounded bg-primary transition-colors"
            onClick={onRetry}
          >
            重试
          </button>
        )}
        {onClose && (
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            onClick={onClose}
          >
            关闭
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== 错误提示条（Toast） ====================

interface WalletErrorToastProps {
  errorCode: WalletErrorCode;
  message?: string;
  onClose: () => void;
  onRetry?: () => void;
  position?: 'top' | 'bottom';
  duration?: number;
}

export function WalletErrorToast({
  errorCode,
  message,
  onClose,
  onRetry,
  position = 'top',
  duration = 5000,
}: WalletErrorToastProps) {
  const config = ERROR_CONFIG[errorCode] || ERROR_CONFIG.UNKNOWN;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`
        fixed z-50 max-w-sm
        ${position === 'top' ? 'top-4 right-4' : 'bottom-4 right-4'}
      `}
      role="alert"
    >
      <div
        className="bg-white rounded-lg shadow-lg border-l-4 border-l-primary p-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-xl">{config.icon}</span>
          <div className="flex-1">
            <div
              className="font-semibold text-sm mb-1 text-primary"
            >
              {config.title}
            </div>
            {message && (
              <div className="text-gray-600 text-xs">
                {message}
              </div>
            )}
          </div>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        {config.retryable && onRetry && (
          <button
            className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-white rounded bg-primary"
            onClick={onRetry}
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== 加载状态组件 ====================

interface WalletLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function WalletLoading({
  text = '正在连接...',
  size = 'md',
}: WalletLoadingProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center gap-3">
      {/* 旋转动画 */}
      <div
        className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
        style={{ 
          borderColor: '#0A2540',
          borderTopColor: 'transparent',
        }}
        aria-hidden
      />
      <span className={sizeClasses[size]} style={{ color: '#0A2540' }}>
        {text}
      </span>
    </div>
  );
}

// ==================== 默认导出 ====================

export default WalletErrorDisplay;
