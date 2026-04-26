'use client';

import React, { useState } from 'react';
import { Input, Button } from '@/components/ui/index';
import { useVote } from '@/hooks/useQueries';
import { toUserErrorMessage } from '@/lib/error-map';

interface VoteFormProps {
  jwt: string | null;
}

/**
 * 参与投票表单
 * 
 * 功能：
 * - 提案 ID 输入
 * - 投票意向选择（赞成/反对/弃权）
 * - 提交状态反馈
 */
export default function VoteForm({ jwt }: VoteFormProps) {
  const [voteId, setVoteId] = useState('');
  const [support, setSupport] = useState<'1' | '0' | '2'>('1');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  const { vote, isPending } = useVote({
    onSuccess: (data) => {
      setOk(true);
      setMsg(`投票成功！累计赞成权重：${(data as Record<string, unknown>).forVotes ?? ''}`);
    },
    onError: (err) => {
      setOk(false);
      setMsg(toUserErrorMessage(err));
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(null);
    if (!voteId.trim()) {
      setMsg('请输入提案 ID');
      setOk(false);
      return;
    }
    if (!jwt) {
      setOk(false);
      setMsg('请先登录（SIWE）');
      return;
    }
    await vote({ proposalId: Number(voteId), support: Number(support) });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <Input
        label="提案 ID"
        placeholder="例如：1"
        value={voteId}
        onChange={(e) => setVoteId(e.target.value)}
        type="number"
      />
      <div>
        <label className="block text-sm font-medium text-primary mb-2">投票意向</label>
        <div className="flex gap-4">
          {([['1', '赞成', 'text-success'], ['0', '反对', 'text-alert'], ['2', '弃权', 'text-steel']] as const).map(([val, label, cls]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="support"
                value={val}
                checked={support === val}
                onChange={() => setSupport(val)}
                className="accent-primary"
              />
              <span className={`text-sm font-medium ${cls}`}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      {msg && (
        <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? '提交中…' : '提交投票'}
      </Button>
    </form>
  );
}
