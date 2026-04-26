'use client';

import React from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/Button';

// ==================== 类型定义与配置 ====================

interface WalletStatusBadgeProps {
  onClick?: () => void;
  showNetwork?: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

const NETWORK_CONFIG: Record<number, { name: string; color: string }> = {
  887766: { name: 'Medical Geth', color: '#2D8A39' },
  1337: { name: 'Localhost', color: '#2D8A39' },
  1: { name: 'Ethereum', color: '#0A2540' },
  137: { name: 'Polygon', color: '#2D8A39' },
};

const COLORS = {
  success: '#2D8A39',
  warning: '#F59E0B',
  error: '#D93025',
  primary: '#0A2540',
  neutral: '#9CA3AF',
};

// ==================== 状态指示点 ====================

function StatusDot({ status }: { status: 'connected' | 'connecting' | 'disconnected' | 'error' }) {
  const bgColor = {
    connected: COLORS.success,
    connecting: COLORS.warning,
    disconnected: COLORS.neutral,
    error: COLORS.error,
  };

  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${status === 'connecting' ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: bgColor[status],
        boxShadow: status === 'connected' ? `0 0 4px ${COLORS.success}40` : 'none',
      }}
      aria-hidden
    />
  );
}

// ==================== 主组件：状态标识 ====================

export function WalletStatusBadge({
  onClick,
  showNetwork = true,
  size = 'md',
  compact = false,
}: WalletStatusBadgeProps) {
  const { address, isConnected, isConnecting, error, chainId, formatAddress } = useWallet();

  const status = error ? 'error' : isConnecting ? 'connecting' : isConnected ? 'connected' : 'disconnected';
  const network = NETWORK_CONFIG[chainId || 0] || { name: `Chain ${chainId}`, color: COLORS.primary };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-3',
  };

  const statusBg = {
    connected: 'rgba(45, 138, 57, 0.08)',
    connecting: 'rgba(245, 158, 11, 0.08)',
    error: 'rgba(217, 48, 37, 0.08)',
    disconnected: 'rgba(156, 163, 175, 0.08)',
  };

  return (
    <div
      className={`
        inline-flex items-center rounded-md border cursor-pointer font-bold
        transition-all duration-200 hover:brightness-95 active:scale-95
        ${sizeClasses[size]}
      `}
      style={{ 
        backgroundColor: statusBg[status],
        borderColor: `${status === 'connected' ? COLORS.success : COLORS.neutral}40`,
        color: COLORS.primary 
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`钱包状态: ${status}`}
    >
      <StatusDot status={status} />
      
      {!compact && (
        <span className="font-mono tracking-tight">
          {status === 'connected' ? formatAddress() : 
           status === 'connecting' ? '连接中' : '未连接'}
        </span>
      )}

      {showNetwork && isConnected && !compact && (
        <span className="flex items-center gap-2 border-l pl-2 border-gray-300 ml-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: network.color }}>
            {network.name}
          </span>
        </span>
      )}
    </div>
  );
}

// ==================== 钱包下拉菜单（修复 ARIA 报错） ====================

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchNetwork?: (chainId: number) => void;
}

export function WalletDropdown({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
}: WalletDropdownProps) {
  const { isConnected, chainId, formatAddress } = useWallet();

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层：确保点击外部可关闭 */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />

      <div
        className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        role="menu"
        aria-label="钱包操作菜单"
      >
        {/* 1. 账号信息区（样式容器而非 role="group"） */}
        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">当前账户</div>
          <div className="font-mono text-sm font-bold truncate text-primary">
            {isConnected ? formatAddress() : '匿名访问'}
          </div>
          {isConnected && (
             <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#2D8A39]">
                <StatusDot status="connected" /> 已通过安全校验
             </div>
          )}
        </div>

        {/* 2. 网络切换区（修复：直接渲染 menuitem） */}
        {isConnected && onSwitchNetwork && (
          <div className="py-2 border-b border-gray-100">
            <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">切换环境</div>
            {Object.entries(NETWORK_CONFIG).map(([id, config]) => {
              const isActive = chainId === parseInt(id);
              return (
                <button
                  key={id}
                  role="menuitem"
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors
                    ${isActive ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                  `}
                  onClick={() => {
                    onSwitchNetwork(parseInt(id));
                    onClose();
                  }}
                >
                  <span className={`font-bold ${isActive ? 'text-success' : 'text-primary'}`}>
                    {config.name}
                  </span>
                  {isActive && <span className="text-[#2D8A39] font-bold text-xs">● 在线</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* 3. 操作区 */}
        <div className="p-3">
          <Button
            role="menuitem"
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: isConnected ? COLORS.error : COLORS.primary }}
            onClick={() => {
              isConnected ? onDisconnect() : onConnect();
              onClose();
            }}
          >
            {isConnected ? '安全退出连接' : '连接加密钱包'}
          </Button>
        </div>
      </div>
    </>
  );
}

export default WalletStatusBadge;