'use client';

import React from 'react';
import { getChainDisplayName } from '../../../lib/chainDisplay';

const PRIMARY = '#0A2540';

type Props = {
  address: string | null;
  isConnected: boolean;
  chainId: number | null | undefined;
};

export function ClaimWalletBar({ address, isConnected, chainId }: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
      style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
    >
      <div>
        <div className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>
          当前钱包
        </div>
        <div className="text-sm font-mono text-slate-900">
          {address ? `${address.slice(0, 10)}…${address.slice(-8)}` : '未连接'}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>
          网络
        </div>
        <div className="text-sm font-medium" style={{ color: PRIMARY }}>
          {isConnected ? getChainDisplayName(chainId ?? null) : '—'}
        </div>
      </div>
      {!isConnected && (
        <span className="text-xs w-full sm:w-auto" style={{ color: '#D93025' }}>
          请先连接钱包后再领取。
        </span>
      )}
    </div>
  );
}
