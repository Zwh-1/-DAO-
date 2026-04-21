/**
 * 交易状态展示组件
 * 
 * 功能：
 * - 显示交易状态（待处理、成功、失败）
 * - 显示交易详情
 * - 提供区块浏览器链接
 * 
 * 视觉规范：
 * - 医疗蓝配色，无蓝紫渐变
 * - 状态颜色：成功绿、警示红、等待黄
 * - 清晰的数据展示
 */

'use client';

import React, { useState } from 'react';

// ==================== 类型定义 ====================

export type TxStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface Transaction {
  /** 交易哈希 */
  hash: string;
  /** 状态 */
  status: TxStatus;
  /** 发送方 */
  from: string;
  /** 接收方 */
  to?: string;
  /** 交易值（ETH） */
  value?: string;
  /** Gas 费用 */
  gasUsed?: string;
  /** 区块号 */
  blockNumber?: number;
  /** 时间戳 */
  timestamp?: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 合约地址（如果是合约部署） */
  contractAddress?: string;
}

interface TxStatusBadgeProps {
  transaction: Transaction;
  /** 区块浏览器 URL */
  explorerUrl?: string;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示详情 */
  showDetails?: boolean;
  /** 简化模式 */
  compact?: boolean;
}

// ==================== 状态配置 ====================

const STATUS_CONFIG: Record<TxStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  borderColor: string;
}> = {
  pending: {
    label: '处理中',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    icon: '⏳',
    borderColor: '#F59E0B',
  },
  success: {
    label: '成功',
    color: '#2D8A39',
    bgColor: 'rgba(45, 138, 57, 0.1)',
    icon: '✓',
    borderColor: '#2D8A39',
  },
  failed: {
    label: '失败',
    color: '#D93025',
    bgColor: 'rgba(217, 48, 37, 0.1)',
    icon: '✕',
    borderColor: '#D93025',
  },
  cancelled: {
    label: '已取消',
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    icon: '🚫',
    borderColor: '#6B7280',
  },
};

// ==================== 工具函数 ====================

/**
 * 格式化地址
 */
function formatAddress(address: string, length: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}

/**
 * 格式化交易哈希
 */
function formatTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * 格式化时间
 */
function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==================== 状态徽章 ====================

function StatusBadge({ status, size = 'md' }: { status: TxStatus; size?: 'sm' | 'md' | 'lg' }) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${sizeClasses[size]}
      `}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// ==================== 主组件 ====================

export function TxStatusBadge({
  transaction,
  explorerUrl = 'https://etherscan.io',
  size = 'md',
  showDetails = false,
  compact = false,
}: TxStatusBadgeProps) {
  const [showFullDetails, setShowFullDetails] = useState(false);
  const config = STATUS_CONFIG[transaction.status];

  // 尺寸映射
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  return (
    <div
      className={`
        rounded-lg border-l-4 bg-white shadow-sm
        ${sizeClasses[size]}
      `}
      style={{ borderLeftColor: config.borderColor }}
    >
      {/* 头部：状态和哈希 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <div className="font-semibold" style={{ color: config.color }}>
              {config.label}
            </div>
            {!compact && (
              <div className="text-xs text-gray-500 mt-0.5">
                {formatTxHash(transaction.hash)}
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={transaction.status} size={size} />
      </div>

      {/* 交易详情 */}
      {showDetails && (
        <div className="space-y-2 pt-3 border-t border-gray-100">
          {/* 发送方 */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">发送方</span>
            <span className="font-mono" style={{ color: '#0A2540' }}>
              {formatAddress(transaction.from)}
            </span>
          </div>

          {/* 接收方 */}
          {transaction.to && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">接收方</span>
              <span className="font-mono" style={{ color: '#0A2540' }}>
                {formatAddress(transaction.to)}
              </span>
            </div>
          )}

          {/* 交易值 */}
          {transaction.value && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">交易值</span>
              <span className="font-medium" style={{ color: '#0A2540' }}>
                {transaction.value} ETH
              </span>
            </div>
          )}

          {/* Gas 费用 */}
          {transaction.gasUsed && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Gas 费用</span>
              <span className="font-mono" style={{ color: '#0A2540' }}>
                {transaction.gasUsed}
              </span>
            </div>
          )}

          {/* 区块号 */}
          {transaction.blockNumber && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">区块号</span>
              <a
                href={`${explorerUrl}/block/${transaction.blockNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline"
              >
                #{transaction.blockNumber}
              </a>
            </div>
          )}

          {/* 时间 */}
          {transaction.timestamp && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">时间</span>
              <span className="text-gray-700">
                {formatTime(transaction.timestamp)}
              </span>
            </div>
          )}

          {/* 错误信息 */}
          {transaction.errorMessage && (
            <div className="mt-3 p-3 bg-red-50 rounded text-xs text-red-700">
              <div className="font-semibold mb-1">错误信息：</div>
              <div className="font-mono">{transaction.errorMessage}</div>
            </div>
          )}

          {/* 合约地址 */}
          {transaction.contractAddress && (
            <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
              <div className="font-semibold mb-1" style={{ color: '#0A2540' }}>
                合约地址：
              </div>
              <a
                href={`${explorerUrl}/address/${transaction.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline break-all"
              >
                {transaction.contractAddress}
              </a>
            </div>
          )}

          {/* 区块浏览器链接 */}
          <div className="pt-3 mt-3 border-t border-gray-100">
            <a
              href={`${explorerUrl}/tx/${transaction.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              在区块浏览器中查看
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

      {/* 展开/收起按钮 */}
      {!showDetails && (
        <button
          className="mt-2 text-sm text-blue-600 hover:underline"
          onClick={() => setShowFullDetails(!showFullDetails)}
        >
          {showFullDetails ? '收起' : '查看详情'}
        </button>
      )}
    </div>
  );
}

// ==================== 交易列表 ====================

interface TxListProps {
  transactions: Transaction[];
  explorerUrl?: string;
  emptyMessage?: string;
}

export function TxList({
  transactions,
  explorerUrl = 'https://etherscan.io',
  emptyMessage = '暂无交易记录',
}: TxListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx, index) => (
        <TxStatusBadge
          key={tx.hash || index}
          transaction={tx}
          explorerUrl={explorerUrl}
          size="sm"
          compact
        />
      ))}
    </div>
  );
}

// ==================== 交易进度条 ====================

interface TxProgressProps {
  status: TxStatus;
  message?: string;
}

export function TxProgress({ status, message }: TxProgressProps) {
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#F59E0B', borderTopColor: 'transparent' }}
        />
        <div>
          <div className="text-sm font-medium" style={{ color: '#F59E0B' }}>
            交易处理中...
          </div>
          {message && (
            <div className="text-xs text-gray-500 mt-1">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
        style={{ backgroundColor: config.color }}
      >
        {config.icon}
      </div>
      <div>
        <div className="text-sm font-medium" style={{ color: config.color }}>
          {config.label}
        </div>
        {message && (
          <div className="text-xs text-gray-500 mt-1">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 默认导出 ====================

export default TxStatusBadge;
