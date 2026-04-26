'use client';

import React, { useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/Button';
import { SUPPORTED_NETWORKS, type NetworkInfo } from '@/lib/wallet/networks';

export type { NetworkInfo };

interface NetworkSwitcherProps {
  networks?: NetworkInfo[];
  showTestnets?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onNetworkChange?: (chainId: number) => void;
}

const DEFAULT_NETWORKS = SUPPORTED_NETWORKS;

// ==================== 网络图标组件 ====================

function NetworkIcon({ chainId, color }: { chainId: number; color: string }) {
  // 根据 ID 返回特定图标，或返回通用医疗标识图标
  return (
    <svg 
      viewBox="0 0 24 24" 
      className="w-5 h-5 flex-shrink-0" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

// ==================== 主组件 ====================

export function NetworkSwitcher({
  networks = DEFAULT_NETWORKS,
  showTestnets = true,
  size = 'md',
  onNetworkChange,
}: NetworkSwitcherProps) {
  const { chainId, switchNetwork } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // 过滤显示的网络
  const availableNetworks = showTestnets
    ? networks
    : networks.filter(n => !n.isTestnet);

  // 获取当前网络详情
  const currentNetwork = networks.find(n => n.chainId === chainId);

  // 样式映射
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-3 py-2 text-sm gap-2',
    lg: 'px-4 py-2.5 text-base gap-3',
  };

  const handleSwitch = useCallback(async (targetChainId: number) => {
    if (targetChainId === chainId) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      await switchNetwork(targetChainId);
      onNetworkChange?.(targetChainId);
      setIsOpen(false);
    } catch (error) {
      console.error('[NetworkSwitcher] Switch failed:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [chainId, switchNetwork, onNetworkChange]);

  return (
    <div className="relative inline-block text-left">
      {/* 触发按钮 */}
      <Button
        className={`
          flex items-center rounded-md border border-gray-300 bg-white
          font-semibold text-slate-900 shadow-sm transition-all
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30
          ${sizeClasses[size]}
          ${isSwitching ? 'opacity-70 cursor-not-allowed' : ''}
        `}
        onClick={() => !isSwitching && setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <NetworkIcon 
          chainId={chainId || 0} 
          color={currentNetwork?.color || '#94A3B8'} 
        />
        <span className="truncate max-w-[120px]">
          {isSwitching ? '正在切换...' : (currentNetwork?.name || '未连接')}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          {/* 全屏透明遮罩用于点击外部关闭 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          <div
            className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="network-menu"
          >
            <div className="py-1" role="none">
              {availableNetworks.map((network) => {
                const isActive = network.chainId === chainId;
                
                return (
                  <button
                    key={network.chainId}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 text-sm
                      transition-colors border-l-4
                      ${isActive 
                        ? 'bg-primary/5 border-primary' 
                        : 'border-transparent hover:bg-gray-50 text-gray-700'
                      }
                    `}
                    role="menuitem"
                    onClick={() => handleSwitch(network.chainId)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: network.color }} 
                      />
                      <div className="flex flex-col items-start">
                        <span className={`font-bold ${isActive ? 'text-primary' : 'text-slate-900'}`}>
                          {network.name}
                        </span>
                        {network.isTestnet && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 bg-amber-50 px-1 rounded mt-0.5">
                            Testnet
                          </span>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* 底部详细信息：高对比度辅助文本 */}
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-tight">
                Current ChainID: <span className="text-gray-900 font-bold">{chainId || 'None'}</span>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== 简易状态灯组件 ====================

export function NetworkStatusBadge({ chainId }: { chainId?: number }) {
  const network = DEFAULT_NETWORKS.find(n => n.chainId === chainId);
  
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
      <span 
        className={`w-1.5 h-1.5 rounded-full ${chainId ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: network?.color || '#94A3B8' }}
      />
      <span className="text-[11px] font-bold text-slate-600">
        {network?.name || 'Offline'}
      </span>
    </div>
  );
}

export default NetworkSwitcher;