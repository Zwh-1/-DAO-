'use client';

import React, { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useFamilyMemberSBT } from '@/hooks/useFamilyMemberSBT';
import {
  getInviteDetail
} from '@/lib/contracts/familyMemberSBT';
import { toast } from '@/store/toastStore';
import { Button } from '@/components/ui/Button';
import { CHAIN_ID, RPC_URL } from '@/types/type';
import { labelFromRelNum, shortenAddr ,Props} from '@/types/member';

export default function InviteNotificationBanner({ onAccepted }: Props) {
  const { myInviteHashes, acceptInvite, isContractReady } = useFamilyMemberSBT();
  const [accepting, setAccepting] = useState<`0x${string}` | null>(null);

  const detailQueries = useQueries({
    queries: myInviteHashes.map((hash) => ({
      queryKey: ['family-sbt', 'invite-detail', hash],
      queryFn:  () => getInviteDetail(hash, CHAIN_ID, RPC_URL),
      staleTime: 30_000,
      retry: 1,
    })),
  });

  if (!isContractReady) return null;

  const activeInvites = detailQueries
    .map((q, i) => ({ hash: myInviteHashes[i], data: q.data, loading: q.isLoading }))
    .filter((item) => item.data?.active);

  if (activeInvites.length === 0) return null;

  async function handleAccept(hash: `0x${string}`) {
    const detail = detailQueries[myInviteHashes.indexOf(hash)]?.data;
    const relation = labelFromRelNum(detail?.relationship ?? 5);
    setAccepting(hash);
    try {
      toast.info('等待钱包确认…', 0);
      const result = await acceptInvite(hash);
      toast.success(`上链成功！已确认与 ${shortenAddr(detail?.primaryHolder ?? '')} 的${relation}关系`);
      onAccepted({
        address:  detail?.primaryHolder ?? '',
        name:     shortenAddr(detail?.primaryHolder ?? ''),
        relation,
        tokenId:  result.tokenId?.toString(),
        txHash:   result.txHash,
      });
    } catch (e) {
      toast.error(`接受失败：${e instanceof Error ? e.message : '请重试'}`);
    } finally {
      setAccepting(null);
    }
  }

  return (
    <section className="card border-l-4 border-l-amber-400 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔔</span>
        <h3 className="font-bold text-slate-800">待确认的家庭关系邀请</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
          {activeInvites.length}
        </span>
      </div>

      <div className="divide-y divide-amber-100">
        {activeInvites.map(({ hash, data }) => (
          <div key={hash} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                <span className="font-mono text-primary">{shortenAddr(data?.primaryHolder ?? '')}</span>
                {' '}邀请您成为其家庭成员
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                关系：{labelFromRelNum(data?.relationship ?? 5)} · {hash.slice(0, 10)}…
              </p>
            </div>
            <Button
              onClick={() => handleAccept(hash)}
              disabled={accepting === hash}
              className="shrink-0 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {accepting === hash ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  上链中…
                </>
              ) : '接受并上链'}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-amber-700 mt-2">
        ⚠ 接受邀请将触发钱包签名，链上记录不可撤销
      </p>
    </section>
  );
}
