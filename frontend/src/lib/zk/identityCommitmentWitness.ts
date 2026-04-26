/**
 * identity_commitment.circom — 与链上 2 public：[social_id_hash, identity_commitment] 一致
 */

import { buildPoseidon } from 'circomlibjs';
import { parseFieldElement } from './fieldScalar';

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

async function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

export type IdentityCommitmentCircuitInput = {
  social_id_hash: string;
  secret: string;
  trapdoor: string;
  identity_commitment: string;
};

export async function buildIdentityCommitmentCircuitInput(params: {
  socialIdHash: string;
  secret: string;
  trapdoor: string;
}): Promise<IdentityCommitmentCircuitInput> {
  const social_id_hash = parseFieldElement(params.socialIdHash);
  const secret = parseFieldElement(params.secret);
  const trapdoor = parseFieldElement(params.trapdoor);
  const poseidon = await getPoseidon();
  const h = poseidon([social_id_hash, secret, trapdoor]);
  const identity_commitment = String(poseidon.F.toObject(h));
  return {
    social_id_hash: String(social_id_hash),
    secret: String(secret),
    trapdoor: String(trapdoor),
    identity_commitment,
  };
}
