/**
 * TrustAid Explorer 主页面
 * 
 * 功能模块：
 * - 顶部状态看板（区块高度、RPC 状态）
 * - 搜索栏（支持交易哈希/地址/区块搜索）
 * - 个人交易历史（需连接钱包）
 * - 全网事件监控
 * 
 * 隐私保护：
 * - 不记录用户私钥或助记词
 * - zk 证明数据脱敏展示
 * - 日志地址脱敏（仅显示前后缀）
 */

"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/features/wallet";
import { useExplorerStore } from "@/store/explorerStore";
import { ExplorerStats } from "@/features/explorer";
import { SearchForm } from "@/features/explorer";
import { TxHistoryTable } from "@/features/explorer";
import { NetworkEventsTable } from "@/features/explorer";

/**
 * Explorer 页面组件
 */
export default function ExplorerPage() {
  // 钱包连接状态
  const { address, isConnected } = useWallet();
  
  // Explorer Store
  const {
    connectedAddress,
    setConnectedAddress,
    loadPersonalTxHistory,
    loadNetworkEvents,
    isLoading,
    error,
  } = useExplorerStore();
  
  // 本地状态
  const [activeTab, setActiveTab] = useState<'personal' | 'network'>('network');
  
  // 初始化：连接钱包地址同步
  useEffect(() => {
    if (isConnected && address) {
      setConnectedAddress(address);
      console.log('[Explorer] 钱包已连接，地址:', address.slice(0, 6) + '...' + address.slice(-4));
    } else {
      setConnectedAddress(null);
    }
  }, [isConnected, address, setConnectedAddress]);
  
  // 初始化：加载全网事件（统计看板由 ExplorerStats + useExplorerStats 负责）
  useEffect(() => {
    loadNetworkEvents({
      pageSize: 30,
      fromBlock: 'latest-500',
    });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 加载个人交易历史（仅当钱包连接且切换到个人标签时）
  useEffect(() => {
    if (connectedAddress && activeTab === 'personal') {
      loadPersonalTxHistory(connectedAddress, {
        pageSize: 20,
      });
    }
  }, [connectedAddress, activeTab, loadPersonalTxHistory]);
  
  return (
    <div className="min-h-screen bg-base">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary">
              TrustAid Explorer
            </h1>
            <p className="mt-2 text-sm text-steel">
              去中心化社区互助平台区块链浏览器
            </p>
          </div>
          
          {/* 网络状态看板 */}
          <ExplorerStats />
          
          {/* 搜索栏 */}
          <div className="mt-6">
            <SearchForm />
          </div>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 error-banner">
            <p className="font-medium">错误</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
        
        {/* 标签切换 */}
        <div className="mb-6 border-b border-gray-100/60">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('network')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'network'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-steel hover:border-primary/30 hover:text-primary'
                }
              `}
            >
              全网事件
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'personal'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-steel hover:border-primary/30 hover:text-primary'
                }
              `}
            >
              个人交易历史
              {!isConnected && (
                <span className="ml-2 text-xs text-steel/50">(需连接钱包)</span>
              )}
            </button>
          </nav>
        </div>
        
        {/* 加载状态 */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="mt-4 text-steel">加载中...</p>
          </div>
        )}
        
        {/* 全网事件监控 */}
        {activeTab === 'network' && !isLoading && (
          <NetworkEventsTable />
        )}
        
        {/* 个人交易历史 */}
        {activeTab === 'personal' && !isLoading && (
          <TxHistoryTable />
        )}
      </div>
    </div>
  );
}
