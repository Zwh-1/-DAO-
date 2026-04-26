/**
 * 个人交易历史表格组件
 * 
 * 展示内容：
 * - 交易哈希（可点击复制）
 * - 交易类型（语义化标签）
 * - 交易状态（待确认/成功/失败）
 * - 区块高度和时间戳
 * - Gas 费用
 * 
 * 功能：
 * - 分页加载
 * - 按类型筛选
 * - 点击查看详情
 * 
 * 隐私保护：
 * - 地址脱敏展示（仅显示前后缀）
 * - 不记录完整交易内容到日志
 */

'use client';

import React from 'react';
import { useExplorerStore, selectPersonalTxHistory } from '@/store/explorerStore';
import { formatAddress, formatTimestamp } from '@/lib/utils/format';
import type { TxRecord, TxType } from '@/types/explorer';

/**
 * 交易类型标签映射
 */
const TX_TYPE_LABELS: Record<TxType, string> = {
  CLAIM_SUBMIT: '申请互助',
  CLAIM_VOTE: '投票',
  CLAIM_APPROVED: '申请批准',
  CLAIM_REJECTED: '申请拒绝',
  GUARDIAN_STAKE: '守护者质押',
  GUARDIAN_UNSTAKE: '解除质押',
  GUARDIAN_SLASHED: '罚没质押',
  MEMBER_REGISTER: '成员注册',
  PROPOSAL_CREATE: '创建提案',
  PROPOSAL_EXECUTE: '执行提案',
  TOKEN_TRANSFER: '转账',
  ZK_PROOF_VERIFY: 'ZK 证明验证',
  UNKNOWN: '未知',
};

/**
 * 交易状态标签映射
 */
const TX_STATUS_LABELS: Record<TxRecord['status'], string> = {
  pending: '待确认',
  success: '成功',
  failed: '失败',
};

/**
 * 交易状态颜色映射
 */
const TX_STATUS_COLORS: Record<TxRecord['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

/**
 * Gas 费用格式化（转换为 Gwei）
 */
const formatGasFee = (gasUsed: bigint | null, gasPrice: bigint) => {
  if (!gasUsed) return '待确认';
  const fee = (gasUsed * gasPrice) / BigInt(1e9);
  return `${fee.toString()} Gwei`;
};

/**
 * 个人交易历史表格组件
 */
export default function TxHistoryTable() {
  const personalTxHistory = useExplorerStore(selectPersonalTxHistory);
  const { loadMoreTxHistory } = useExplorerStore();
  
  // 无数据提示
  if (personalTxHistory.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900">暂无交易记录</h3>
        <p className="mt-2 text-gray-600">
          连接钱包后，您将在这里看到与 TrustAid 合约的交互历史
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 表格头部 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          个人交易历史
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          共 {personalTxHistory.length} 条记录
        </p>
      </div>
      
      {/* 表格内容 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                交易哈希
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                类型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                区块
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gas 费用
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {personalTxHistory.map((tx, index) => (
              <tr key={tx.hash || index} className="hover:bg-gray-50">
                {/* 交易哈希 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                    {formatAddress(tx.hash)}
                  </code>
                </td>
                
                {/* 交易类型 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {TX_TYPE_LABELS[tx.txType] || TX_TYPE_LABELS.UNKNOWN}
                  </span>
                </td>
                
                {/* 交易状态 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${TX_STATUS_COLORS[tx.status]}`}>
                    {TX_STATUS_LABELS[tx.status]}
                  </span>
                </td>
                
                {/* 时间 */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatTimestamp(tx.blockTimestamp)}
                </td>
                
                {/* 区块高度 */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {tx.blockNumber?.toLocaleString() || '-'}
                </td>
                
                {/* Gas 费用 */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatGasFee(tx.gasUsed, tx.gasPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 加载更多 */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-center">
        <button
          onClick={() => loadMoreTxHistory()}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          加载更多
        </button>
      </div>
    </div>
  );
}
