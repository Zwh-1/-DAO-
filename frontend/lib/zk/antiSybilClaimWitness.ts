/**
 * anti_sybil_claim.circom — 与 circuits/src 中 identitySecret / airdropId / claimAmount 命名一致
 */

import { buildPoseidon } from 'circomlibjs';
import { parseFieldElement } from './fieldScalar';

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

async function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

export async function computeAntiSybilClaimNullifier(
  identitySecret: bigint,
  airdropId: bigint
): Promise<string> {
  const poseidon = await getPoseidon();
  const h = poseidon([identitySecret, airdropId]);
  return String(poseidon.F.toObject(h));
}

export type AntiSybilClaimCircuitInput = {
  identitySecret: string;
  airdropId: string;
  expectedNullifierHash: string;
  /** circom 信号名 camelCase */
  claimAmount: string;
  maxClaimAmount: string;
};

export async function buildAntiSybilClaimCircuitInput(params: {
  identitySecret: string;
  airdropId: string;
  claimAmount: string;
  maxClaimAmount: string;
}): Promise<AntiSybilClaimCircuitInput> {
  const identitySecret = parseFieldElement(params.identitySecret);
  const airdropId = parseFieldElement(params.airdropId);
  const expectedNullifierHash = await computeAntiSybilClaimNullifier(identitySecret, airdropId);
  return {
    identitySecret: String(identitySecret),
    airdropId: String(airdropId),
    expectedNullifierHash,
    claimAmount: String(BigInt(String(params.claimAmount))),
    maxClaimAmount: String(BigInt(String(params.maxClaimAmount))),
  };
}
