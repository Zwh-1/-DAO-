/**
 * anonymous_claim.circom 链下 witness / 公开输入构造（与 circuits/src/anonymous_claim.circom 一致）
 *
 * - Nullifier = Poseidon(secret, airdrop_id)
 * - Commitment = Poseidon(secret, nullifier)
 * - Merkle 叶子 = commitment
 */

import { buildPoseidon } from 'circomlibjs';
import { parseFieldElement } from './fieldScalar';

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

async function getPoseidon() {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon();
  }
  return poseidonPromise;
}

export async function computeAnonymousNullifier(secret: bigint, airdropId: bigint): Promise<string> {
  const poseidon = await getPoseidon();
  const h = poseidon([secret, airdropId]);
  return String(poseidon.F.toObject(h));
}

export async function computeAnonymousCommitment(secret: bigint, nullifier: bigint): Promise<string> {
  const poseidon = await getPoseidon();
  const h = poseidon([secret, nullifier]);
  return String(poseidon.F.toObject(h));
}

function padMerklePath(path: string[], depth: number): string[] {
  const out = path.map((x) => String(BigInt(String(x))));
  while (out.length < depth) {
    out.push('0');
  }
  if (out.length > depth) {
    throw new Error(`merkle_path length ${out.length} exceeds depth ${depth}`);
  }
  return out;
}

export type AnonymousClaimCircuitInput = {
  secret: string;
  leaf_index: string;
  merkle_path: string[];
  airdrop_id: string;
  merkle_root: string;
  nullifier: string;
  commitment: string;
  claim_amount: string;
  current_timestamp: string;
  ts_start: string;
  ts_end: string;
};

/**
 * 构造 snarkjs.groth16.fullProve 所需 input 对象（键名与 circom 编译产物一致）
 */
export async function buildAnonymousClaimCircuitInput(params: {
  secret: string;
  airdropId: string;
  leafIndex: number;
  merklePath: string[];
  merkleRoot: string;
  claimAmountWei: string;
  currentTimestamp: string;
  tsStart: string;
  tsEnd: string;
  merkleDepth?: number;
}): Promise<AnonymousClaimCircuitInput> {
  const depth = params.merkleDepth ?? 20;
  const secret = parseFieldElement(params.secret);
  const airdropId = parseFieldElement(params.airdropId);

  const nullifierStr = await computeAnonymousNullifier(secret, airdropId);
  const nullifierBi = BigInt(nullifierStr);
  const commitmentStr = await computeAnonymousCommitment(secret, nullifierBi);

  const merkle_path = padMerklePath(params.merklePath, depth);

  return {
    secret: String(secret),
    leaf_index: String(params.leafIndex),
    merkle_path,
    airdrop_id: String(airdropId),
    merkle_root: String(BigInt(String(params.merkleRoot))),
    nullifier: nullifierStr,
    commitment: commitmentStr,
    claim_amount: String(BigInt(String(params.claimAmountWei))),
    current_timestamp: String(BigInt(String(params.currentTimestamp))),
    ts_start: String(BigInt(String(params.tsStart))),
    ts_end: String(BigInt(String(params.tsEnd))),
  };
}
