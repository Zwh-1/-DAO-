'use client';

import React from 'react';
import { getChainDisplayName } from '@/lib/utils/chainDisplay';

type Props = {
  address: string | null;
  isConnected: boolean;
  chainId: number | null | undefined;
};

export function ClaimWalletBar({ address, isConnected, chainId }: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 border-slate-200 bg-white"
    >
      <div>
        <div className="text-xs font-medium mb-1 text-slate-500">
          当前钱包
        </div>
        <div className="text-sm font-mono text-slate-900">
          {address ? `${address.slice(0, 10)}…${address.slice(-8)}` : '未连接'}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-medium mb-1 text-slate-500">
          网络
        </div>
        <div className="text-sm font-medium text-primary">
          {isConnected ? getChainDisplayName(chainId ?? null) : '—'}
        </div>
      </div>
      {!isConnected && (
        <span className="text-xs w-full sm:w-auto text-alert">
          请先连接钱包后再领取。
        </span>
      )}
    </div>
  );
}
