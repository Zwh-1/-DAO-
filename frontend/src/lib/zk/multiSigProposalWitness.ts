import { parseFieldElement } from './fieldScalar';

const N = 5;

export type MultiSigProposalCircuitInput = {
  signer_keys: string[];
  voted: string[];
  weights: string[];
  proposal_id: string;
  threshold: string;
  auth_hash: string;
};

export function buildMultiSigProposalCircuitInput(p: {
  signerKeys: string[];
  voted: string[];
  weights: string[];
  proposalId: string;
  threshold: string;
  authHash: string;
}): MultiSigProposalCircuitInput {
  const pad = (arr: string[], label: string) => {
    const a = [...arr.map((x) => String(parseFieldElement(x)))];
    if (a.length !== N) throw new Error(`${label} must have length ${N}`);
    return a;
  };
  return {
    signer_keys: pad(p.signerKeys, 'signerKeys'),
    voted: pad(p.voted, 'voted'),
    weights: pad(p.weights, 'weights'),
    proposal_id: String(parseFieldElement(p.proposalId)),
    threshold: String(parseFieldElement(p.threshold)),
    auth_hash: String(parseFieldElement(p.authHash)),
  };
}
