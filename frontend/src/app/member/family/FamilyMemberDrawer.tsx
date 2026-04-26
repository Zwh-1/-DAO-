'use client';

import React from 'react';
import { useFamilyMember } from '@/hooks/useFamilyMemberSBT';
import { formatAddress, formatTimestamp } from '@/lib/utils/format';
import { labelFromRelNum, shortHash,RELATION_EMOJI,
   EXPLORER_BASE ,FamilyMemberDrawerProps} from '@/types/member';
import {Button} from '@/components/ui/Button';
// ── 组件 ─────────────────────────────────────────────────────────────────────

export default function FamilyMemberDrawer({
  member,
  isOpen,
  onClose,
  onRemove,
  onDeactivate,
  isDeactivating = false,
}: FamilyMemberDrawerProps) {
  const { data: chain, isLoading: chainLoading } = useFamilyMember(member?.tokenId);

  const isActive = chain ? chain.isActive : true;
  const joinDate = chain ? formatTimestamp(chain.joinTimestamp) : null;
  const chainRel = chain ? labelFromRelNum(chain.relationship) : member?.relation;
  const txUrl    = EXPLORER_BASE && member?.txHash
    ? `${EXPLORER_BASE}/tx/${member.txHash}`
    : null;

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-primary text-lg">成员详情</h2>
          <Button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Identity card */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <span className="text-4xl">{member ? RELATION_EMOJI[member.relation] : '👤'}</span>
            <div>
              <p className="text-lg font-bold text-slate-800">{member?.name}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {member ? formatAddress(member.address) : '—'}
              </p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-primary/10 text-primary">
              {chainRel ?? member?.relation}
            </span>
            {chain && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  isActive
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isActive ? '已激活' : '已停用'}
              </span>
            )}
          </div>

          {/* Chain data */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">链上信息</h3>

            {!member?.tokenId ? (
              <p className="text-sm text-slate-400 italic">合约未配置或尚未上链</p>
            ) : chainLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : chain ? (
              <dl className="space-y-3">
                {/* Join time */}
                <div className="flex justify-between items-start">
                  <dt className="text-sm text-slate-500">加入时间</dt>
                  <dd className="text-sm font-medium text-slate-800 text-right">{joinDate}</dd>
                </div>

                {/* Token ID */}
                <div className="flex justify-between items-start">
                  <dt className="text-sm text-slate-500">Token ID</dt>
                  <dd className="text-sm font-mono text-slate-800">#{member.tokenId?.toString()}</dd>
                </div>

                {/* Hash preview */}
                <div className="flex justify-between items-start gap-4">
                  <dt className="text-sm text-slate-500 shrink-0">身份存证</dt>
                  <dd className="text-sm font-mono text-slate-600 break-all text-right">
                    {shortHash(chain.memberIdHash)}
                    <span className="ml-1 text-xs text-slate-400">（哈希前8位）</span>
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>

          {/* Transaction link */}
          {member?.txHash && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">链上记录</h3>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <p className="text-xs font-mono text-slate-500">{shortHash(member.txHash)}</p>
                {txUrl ? (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-medium shrink-0"
                  >
                    浏览器查看 ↗
                  </a>
                ) : (
                  <span className="text-xs text-slate-300">浏览器未配置</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {member && (
          <div className="px-5 py-4 border-t border-slate-100 space-y-2">
            {chain && isActive && member.tokenId && (
              <Button
                onClick={() => onDeactivate(member.tokenId!)}
                disabled={isDeactivating}
                className="w-full py-2.5 rounded-xl border border-alert text-alert text-sm font-semibold hover:bg-alert/5 transition-colors disabled:opacity-50"
              >
                {isDeactivating ? '处理中…' : '停用成员'}
              </Button>
            )}
            <Button
              onClick={() => { onRemove(member.id); onClose(); }}
              className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              从列表移除
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
