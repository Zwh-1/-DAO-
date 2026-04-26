'use client';

import React from 'react';
import type { AnonymousClaimStatus } from '@/lib/api/anonymousClaim';
import {
  formatWeiEthLabel,
  getClaimWindowPhase,
  windowPhaseLabel,
} from '../claimUiUtils';

const SUCCESS = '#2D8A39';
const WARN = '#B45309';

type Props = {
  status: AnonymousClaimStatus | null;
  contractUnavailable: boolean;
  tsStart: string;
  tsEnd: string;
  chainMerkleRoot: string | null;
  offchainRoot: string | null;
  rootMismatch: boolean;
  formatUnixReadable: (sec: string) => string;
};

export function ClaimPoolSummary({
  status,
  contractUnavailable,
  tsStart,
  tsEnd,
  chainMerkleRoot,
  offchainRoot,
  rootMismatch,
  formatUnixReadable,
}: Props) {
  const phase = getClaimWindowPhase(tsStart, tsEnd);
  const phaseColor =
    phase === 'active' ? SUCCESS : phase === 'ended' ? '#D93025' : WARN;

  return (
    <div
      className="rounded-lg border p-4 space-y-3 border-slate-200 border-l-4 border-l-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-primary">
          资金池与活动时间
        </h4>
        {tsStart && tsEnd && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              phase === 'active' ? 'bg-green-50' : 'bg-yellow-50'
            }`}
            style={{ color: phaseColor }}
          >
            {windowPhaseLabel(phase)}
          </span>
        )}
      </div>

      {contractUnavailable && (
        <p className="text-sm rounded-md border px-3 py-2 border-amber-200 text-amber-800 bg-amber-50">
          链上合约未连接或未配置（RPC / ANONYMOUS_CLAIM_ADDRESS）。仍可尝试链下同步 Merkle，但无法从链上读取池子与时间窗。
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-md p-2 bg-slate-50">
          <div className="text-slate-500">池内余额</div>
          <div className="font-semibold mt-0.5 text-slate-900">
            {status?.totalBalance != null ? formatWeiEthLabel(status.totalBalance) : '—'}
          </div>
        </div>
        <div className="rounded-md p-2 bg-slate-50">
          <div className="text-slate-500">累计已领取</div>
          <div className="font-semibold mt-0.5 text-slate-900">
            {status?.totalClaimed != null ? formatWeiEthLabel(status.totalClaimed) : '—'}
          </div>
        </div>
        <div className="rounded-md p-2 bg-slate-50">
          <div className="text-slate-500">领取次数</div>
          <div className="font-semibold mt-0.5 text-slate-900">
            {status?.claimCount ?? '—'}
          </div>
        </div>
        <div className="rounded-md p-2 bg-slate-50">
          <div className="text-slate-500">剩余可领（统计）</div>
          <div className="font-semibold mt-0.5 text-slate-900">
            {status?.remainingBalance != null ? formatWeiEthLabel(status.remainingBalance) : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
        <div>
          <span className="font-medium text-slate-700">开始时间：</span>
          {formatUnixReadable(tsStart)}
          {tsStart ? (
            <span className="block font-mono text-[10px] mt-0.5">Unix: {tsStart}</span>
          ) : null}
        </div>
        <div>
          <span className="font-medium text-slate-700">结束时间：</span>
          {formatUnixReadable(tsEnd)}
          {tsEnd ? (
            <span className="block font-mono text-[10px] mt-0.5">Unix: {tsEnd}</span>
          ) : null}
        </div>
      </div>

      {chainMerkleRoot && (
        <p className="text-xs break-all text-slate-500">
          <span className="font-medium text-slate-700">Merkle 根：</span>
          {chainMerkleRoot}
        </p>
      )}
      {offchainRoot && (
        <p className="text-xs break-all text-slate-500">
          <span className="font-medium text-slate-700">链下树根：</span>
          {offchainRoot}
        </p>
      )}
      {rootMismatch && (
        <p className="text-xs text-red-700">
          链上与链下 Merkle 根不一致时，链上验证将失败，需运维对齐白名单与合约部署根。
        </p>
      )}
    </div>
  );
}
