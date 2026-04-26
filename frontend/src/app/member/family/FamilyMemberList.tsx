'use client';

import React from 'react';
import type { StoredMember, MemberStatus } from '@/store/familyStore';
import { Button } from '@/components/ui/Button';
import { RELATION_EMOJI } from '@/types/member';

const STATUS_BADGE: Record<MemberStatus, { label: string; cls: string }> = {
  local:    { label: '仅本地',   cls: 'bg-slate-100 text-slate-500' },
  invited:  { label: '待对方确认', cls: 'bg-amber-100 text-amber-700' },
  on_chain: { label: '已上链',   cls: 'bg-green-50  text-green-700 border border-green-200' },
};

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type LocalMember = Omit<StoredMember, 'tokenId'> & { tokenId?: bigint };

interface FamilyMemberListProps {
  members: LocalMember[];
  onMemberClick: (member: LocalMember) => void;
  onAddClick: () => void;
  isContractReady: boolean;
}

/**
 * 家庭成员列表组件
 * 
 * 职责：
 * - 展示成员卡片（关系、地址、状态）
 * - 空状态引导添加
 * - 点击成员触发详情抽屉
 */
export default function FamilyMemberList({
  members,
  onMemberClick,
  onAddClick,
  isContractReady,
}: FamilyMemberListProps) {
  if (members.length === 0) {
    return (
      <section className="card">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👨‍👧👦</div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">暂无家庭成员</h3>
          <p className="text-slate-500 mb-6">添加家庭成员以共享福利和保障</p>
          <Button
            onClick={onAddClick}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            添加家庭成员
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <ul className="divide-y divide-slate-100">
        {members.map(m => (
          <li
            key={m.id}
            onClick={() => onMemberClick(m)}
            className="flex items-center justify-between py-4 gap-4 cursor-pointer hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{RELATION_EMOJI[m.relation]}</span>
              <div>
                <p className="font-semibold text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-400 font-mono">{shortenAddr(m.address)}</p>
                {m.txHash && (
                  <p className="text-xs text-green-600 font-mono mt-0.5">
                    已上链 {shortenAddr(m.txHash)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                {m.relation}
              </span>
              {m.status && (
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[m.status]?.cls ?? ''}`}>
                  {STATUS_BADGE[m.status]?.label}
                </span>
              )}
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
