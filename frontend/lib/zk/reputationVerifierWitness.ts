import { parseFieldElement } from './fieldScalar';

const N = 5;

export type ReputationVerifierCircuitInput = {
  past_behaviors: string[];
  weights: string[];
  required_score: string;
  reputation_hash: string;
};

export function buildReputationVerifierCircuitInput(p: {
  pastBehaviors: string[];
  weights: string[];
  requiredScore: string;
  reputationHash: string;
}): ReputationVerifierCircuitInput {
  const pb = p.pastBehaviors.map((x) => String(parseFieldElement(x)));
  const w = p.weights.map((x) => String(parseFieldElement(x)));
  if (pb.length !== N || w.length !== N) {
    throw new Error(`pastBehaviors and weights must have length ${N}`);
  }
  return {
    past_behaviors: pb,
    weights: w,
    required_score: String(parseFieldElement(p.requiredScore)),
    reputation_hash: String(parseFieldElement(p.reputationHash)),
  };
}
