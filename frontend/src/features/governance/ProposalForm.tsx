'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSubmitProposal } from '@/hooks/useQueries';
import { toUserErrorMessage } from '@/lib/error-map';

interface ProposalFormProps {
  jwt: string | null;
}

/**
 * 发起提案表单
 * 
 * 功能：
 * - 提案描述输入
 * - SBT 积分校验提示
 * - 提交状态反馈
 */
export default function ProposalForm({ jwt }: ProposalFormProps) {
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  const { submitProposal, isPending } = useSubmitProposal({
    onSuccess: (data) => {
      setOk(true);
      setMsg(`提案 #${data.proposalId ?? '?'} 已创建，投票开始！`);
      setDesc('');
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
    if (!desc.trim()) {
      setMsg('提案描述不能为空');
      setOk(false);
      return;
    }
    if (!jwt) {
      setOk(false);
      setMsg('请先登录（SIWE）');
      return;
    }
    await submitProposal({ description: desc.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="rounded-2xl bg-surface/50 border border-gray-100/60 p-4 text-sm text-steel">
        发起提案需持有 SBT 积分（由后端校验）。提案一旦发起，投票期为 <strong className="text-primary">3 天</strong>。
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">提案描述</label>
        <textarea
          className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          rows={4}
          placeholder="请清晰描述本提案的目标、预期效果及执行方式..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      {msg && (
        <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? '提交中…' : '发起提案'}
      </Button>
    </form>
  );
}
