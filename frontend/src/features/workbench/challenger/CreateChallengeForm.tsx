'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createChallenge } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';
import {
  requireEthAddress,
  requireIpfsUri,
  requireMinimum,
  requireNonEmpty,
  requireTxHash,
} from '@/lib/validators';
import { Input, Button } from '@/components/ui/index';

export function CreateChallengeForm(props: { defaultChallenger?: string | null; onSuccess?: () => void }) {
  const [form, setForm] = useState({
    proposalId: '101',
    reasonCode: 'INVALID_EVIDENCE',
    evidenceSnapshot: 'ipfs://QmSecondary',
    txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    challenger: props.defaultChallenger || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    stakeAmount: '150',
  });
  const [result, setResult] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (props.defaultChallenger) {
      setForm((f) => ({ ...f, challenger: props.defaultChallenger! }));
    }
  }, [props.defaultChallenger]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      requireNonEmpty(form.proposalId, 'proposalId');
      requireNonEmpty(form.reasonCode, 'reasonCode');
      requireIpfsUri(form.evidenceSnapshot, 'evidenceSnapshot');
      requireTxHash(form.txHash, 'txHash');
      requireEthAddress(form.challenger, 'challenger');
      requireMinimum(Number(form.stakeAmount), 100, 'stakeAmount');
      const data = await createChallenge({
        ...form,
        stakeAmount: Number(form.stakeAmount),
      });
      setResult(JSON.stringify(data, null, 2));
      props.onSuccess?.();
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    }
  }

  return (
    <>
      <section className="card">
        <h2 className="mb-3 section-title">发起挑战</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Proposal ID"
            value={form.proposalId}
            onChange={(e) => setForm({ ...form, proposalId: e.target.value })}
          />
          <Input
            label="Reason Code"
            value={form.reasonCode}
            onChange={(e) => setForm({ ...form, reasonCode: e.target.value })}
          />
          <Input
            label="Evidence Snapshot CID"
            value={form.evidenceSnapshot}
            onChange={(e) => setForm({ ...form, evidenceSnapshot: e.target.value })}
          />
          <Input label="Tx Hash" value={form.txHash} onChange={(e) => setForm({ ...form, txHash: e.target.value })} />
          <Input
            label="Challenger Address"
            value={form.challenger}
            onChange={(e) => setForm({ ...form, challenger: e.target.value })}
          />
          <Input
            label="Stake Amount"
            value={form.stakeAmount}
            onChange={(e) => setForm({ ...form, stakeAmount: e.target.value })}
          />
          <Button type="submit" variant="danger">
            发起挑战
          </Button>
        </form>
      </section>

      <pre className="result-pre">{result || '接口返回结果会显示在这里'}</pre>

      {formError && <section className="error-banner">{formError}</section>}
    </>
  );
}
