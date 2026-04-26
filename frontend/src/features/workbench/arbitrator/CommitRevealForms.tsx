'use client';

import { FormEvent, useEffect, useState } from 'react';
import { commitArbitration, revealArbitration } from '@/lib/api';
import { toUserErrorMessage } from '@/lib/error-map';
import { requireEthAddress, requireNonEmpty } from '@/lib/validators';
import { Input, Button } from '@/components/ui/index';

export function CommitRevealForms(props: { initialProposalId?: string }) {
  const initPid = props.initialProposalId?.trim() || '101';

  const [commitForm, setCommitForm] = useState({
    proposalId: initPid,
    commitment: '0xcommitmenthash',
    arbitrator: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  });
  const [revealForm, setRevealForm] = useState({
    proposalId: initPid,
    choice: 'APPROVE',
    salt: 'secret-salt-001',
    arbitrator: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  });
  const [result, setResult] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (props.initialProposalId?.trim()) {
      const p = props.initialProposalId.trim();
      setCommitForm((c) => ({ ...c, proposalId: p }));
      setRevealForm((r) => ({ ...r, proposalId: p }));
    }
  }, [props.initialProposalId]);

  async function onCommit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      requireNonEmpty(commitForm.proposalId, 'proposalId');
      requireNonEmpty(commitForm.commitment, 'commitment');
      requireEthAddress(commitForm.arbitrator, 'arbitrator');
      const data = await commitArbitration(commitForm);
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    }
  }

  async function onReveal(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      requireNonEmpty(revealForm.proposalId, 'proposalId');
      requireNonEmpty(revealForm.choice, 'choice');
      requireNonEmpty(revealForm.salt, 'salt');
      requireEthAddress(revealForm.arbitrator, 'arbitrator');
      const data = await revealArbitration(revealForm);
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 section-title">Commit 阶段</h2>
          <form onSubmit={onCommit} className="space-y-3">
            <Input
              label="Proposal ID"
              value={commitForm.proposalId}
              onChange={(e) => setCommitForm({ ...commitForm, proposalId: e.target.value })}
            />
            <Input
              label="Commitment"
              value={commitForm.commitment}
              onChange={(e) => setCommitForm({ ...commitForm, commitment: e.target.value })}
            />
            <Input
              label="Arbitrator Address"
              value={commitForm.arbitrator}
              onChange={(e) => setCommitForm({ ...commitForm, arbitrator: e.target.value })}
            />
            <Button type="submit" variant="primary" size="lg" className="mt-4 w-full">
              提交 Commit
            </Button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-5 section-title">Reveal 阶段</h2>
          <form onSubmit={onReveal} className="space-y-4">
            <Input
              label="Proposal ID"
              value={revealForm.proposalId}
              onChange={(e) => setRevealForm({ ...revealForm, proposalId: e.target.value })}
            />
            <Input
              label="Choice"
              value={revealForm.choice}
              onChange={(e) => setRevealForm({ ...revealForm, choice: e.target.value })}
            />
            <Input label="Salt" value={revealForm.salt} onChange={(e) => setRevealForm({ ...revealForm, salt: e.target.value })} />
            <Input
              label="Arbitrator Address"
              value={revealForm.arbitrator}
              onChange={(e) => setRevealForm({ ...revealForm, arbitrator: e.target.value })}
            />
            <Button type="submit" variant="success" size="lg" className="mt-4 w-full">
              提交 Reveal
            </Button>
          </form>
        </section>
      </div>

      <pre className="result-pre">{result || '接口返回结果会显示在这里'}</pre>

      {formError && <section className="error-banner">{formError}</section>}
    </>
  );
}
