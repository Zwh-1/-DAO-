/**
 * 全网事件监控表格组件
 * 
 * 展示内容：
 * - 事件名称（如 ClaimSubmitted）
 * - 合约名称和地址
 * - 区块高度和时间戳
 * - 交易哈希
 * - 事件摘要
 * - 严重程度标签
 * 
 * 功能：
 * - 按事件类型筛选
 * - 分页加载
 * - 点击查看详情
 * 
 * 隐私保护：
 * - 地址脱敏展示
 * - 敏感事件参数脱敏
 */

'use client';

import React from 'react';
import { useExplorerStore, selectNetworkEvents } from '../../store/explorer-store';
import type { ChainEvent, EventSeverity } from '../../types/explorer';

/**
 * 事件严重程度标签映射
 */
const SEVERITY_LABELS: Record<EventSeverity, string> = {
  info: '信息',
  warning: '警告',
  critical: '严重',
};

/**
 * 事件严重程度颜色映射
 */
const SEVERITY_COLORS: Record<EventSeverity, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};

/**
 * 事件图标映射
 */
const EVENT_ICONS: Record<string, string> = {
  MemberRegistered: '👤',
  ClaimSubmitted: '📝',
  ClaimVoted: '🗳️',
  ClaimApproved: '✅',
  ClaimRejected: '❌',
  GuardianStaked: '💰',
  GuardianSlashed: '⚠️',
  ProposalCreated: '📋',
  ProposalExecuted: '✔️',
  ZKProofVerified: '🔐',
};

/**
 * 地址脱敏展示
 */
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * 时间格式化
 */
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN');
};

/**
 * 交易哈希格式化
 */
const formatTxHash = (hash: string) => {
  if (!hash) return '';
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

/**
 * 全网事件监控表格组件
 */
export default function NetworkEventsTable() {
  const networkEvents = useExplorerStore(selectNetworkEvents);
  const { loadMoreNetworkEvents } = useExplorerStore();
  
  // 无数据提示
  if (networkEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📡</div>
        <h3 className="text-lg font-medium text-gray-900">暂无全网事件</h3>
        <p className="mt-2 text-gray-600">
          平台最近 500 个区块内没有发生事件
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 表格头部 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          全网事件监控
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          共 {networkEvents.length} 条记录（最近 500 个区块）
        </p>
      </div>
      
      {/* 表格内容 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                事件类型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                严重程度
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                合约
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                区块
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                交易哈希
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                摘要
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {networkEvents.map((event, index) => {
              const icon = EVENT_ICONS[event.eventName] || '📌';
              
              return (
                <tr key={event.eventId || index} className="hover:bg-gray-50">
                  {/* 事件类型 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{icon}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {event.eventName}
                      </span>
                    </div>
                  </td>
                  
                  {/* 严重程度 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${SEVERITY_COLORS[event.severity]}`}>
                      {SEVERITY_LABELS[event.severity]}
                    </span>
                  </td>
                  
                  {/* 合约地址 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">
                      {event.contractName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatAddress(event.contractAddress)}
                    </div>
                  </td>
                  
                  {/* 时间 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatTimestamp(event.blockTimestamp)}
                  </td>
                  
                  {/* 区块高度 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {event.blockNumber.toLocaleString()}
                  </td>
                  
                  {/* 交易哈希 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                      {formatTxHash(event.txHash)}
                    </code>
                  </td>
                  
                  {/* 事件摘要 */}
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {event.displaySummary}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* 加载更多 */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-center">
        <button
          onClick={() => loadMoreNetworkEvents()}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          加载更多
        </button>
      </div>
    </div>
  );
}
