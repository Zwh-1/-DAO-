/**
 * anti_sybil_verifier.circom — witness / 全量 input（与 circuits/src 信号名一致）
 * parameter_hash = Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)
 * merkle_leaf = Poseidon(identity_commitment, user_level)
 */

import { buildPoseidon } from 'circomlibjs';
import { parseFieldElement } from './fieldScalar';

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

async function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

export const ANTI_SYBIL_VERIFIER_MERKLE_LEVELS = 20;

export async function computeAntiSybilParameterHash(
  minLevel: bigint,
  minAmount: bigint,
  maxAmount: bigint,
  tsStart: bigint,
  tsEnd: bigint,
  airdropProjectId: bigint
): Promise<string> {
  const poseidon = await getPoseidon();
  const h = poseidon([minLevel, minAmount, maxAmount, tsStart, tsEnd, airdropProjectId]);
  return String(poseidon.F.toObject(h));
}

export async function computeAntiSybilMerkleLeaf(
  identityCommitment: bigint,
  userLevel: bigint
): Promise<string> {
  const poseidon = await getPoseidon();
  const h = poseidon([identityCommitment, userLevel]);
  return String(poseidon.F.toObject(h));
}

export async function computeAntiSybilNullifierHash(
  secret: bigint,
  airdropProjectId: bigint
): Promise<string> {
  const poseidon = await getPoseidon();
  const h = poseidon([secret, airdropProjectId]);
  return String(poseidon.F.toObject(h));
}

function padPath(arr: string[], depth: number, fill = '0'): string[] {
  const src = Array.isArray(arr) ? arr.map((x) => String(BigInt(String(x)))) : [];
  const out = [...src];
  while (out.length < depth) out.push(fill);
  if (out.length > depth) throw new Error(`path length ${out.length} > ${depth}`);
  return out;
}

export type AntiSybilVerifierCircuitInput = Record<string, string | string[]>;

/**
 * 构造 snarkjs fullProve 所需 input（键名与 circom 一致）
 */
export async function buildAntiSybilVerifierCircuitInput(params: {
  secret: string;
  trapdoor: string;
  socialIdHash: string;
  pathElements: string[];
  pathIndex: (0 | 1 | '0' | '1')[];
  minLevel: string;
  minAmount: string;
  maxAmount: string;
  tsStart: string;
  tsEnd: string;
  airdropProjectId: string;
  merkleRoot: string;
  identityCommitment: string;
  userLevel: string;
  claimAmount: string;
  claimTs: string;
  /** 若省略则按电路公式计算 */
  parameterHash?: string;
  /** 若省略则 Poseidon(identity_commitment, user_level) */
  merkleLeaf?: string;
  /** 若省略则 Poseidon(secret, airdrop_project_id) */
  nullifierHash?: string;
  merkleLevels?: number;
}): Promise<AntiSybilVerifierCircuitInput> {
  const depth = params.merkleLevels ?? ANTI_SYBIL_VERIFIER_MERKLE_LEVELS;
  const secret = parseFieldElement(params.secret);
  const trapdoor = parseFieldElement(params.trapdoor);
  const social_id_hash = parseFieldElement(params.socialIdHash);
  const min_level = parseFieldElement(params.minLevel);
  const min_amount = parseFieldElement(params.minAmount);
  const max_amount = parseFieldElement(params.maxAmount);
  const ts_start = parseFieldElement(params.tsStart);
  const ts_end = parseFieldElement(params.tsEnd);
  const airdrop_project_id = parseFieldElement(params.airdropProjectId);
  const merkle_root = parseFieldElement(params.merkleRoot);
  const identity_commitment = parseFieldElement(params.identityCommitment);
  const user_level = parseFieldElement(params.userLevel);
  const claim_amount = parseFieldElement(params.claimAmount);
  const claim_ts = parseFieldElement(params.claimTs);

  const parameter_hash = params.parameterHash
    ? String(BigInt(String(params.parameterHash)))
    : await computeAntiSybilParameterHash(
        min_level,
        min_amount,
        max_amount,
        ts_start,
        ts_end,
        airdrop_project_id
      );

  const merkle_leaf = params.merkleLeaf
    ? String(BigInt(String(params.merkleLeaf)))
    : await computeAntiSybilMerkleLeaf(identity_commitment, user_level);

  const nullifier_hash = params.nullifierHash
    ? String(BigInt(String(params.nullifierHash)))
    : await computeAntiSybilNullifierHash(secret, airdrop_project_id);

  const pathElements = padPath(params.pathElements, depth);
  const pathIndexSrc = Array.isArray(params.pathIndex) ? params.pathIndex : [];
  const pathIndex = padPath(
    pathIndexSrc.map((x) => (String(x) === '1' ? '1' : '0')),
    depth,
    '0'
  );

  return {
    secret: String(secret),
    trapdoor: String(trapdoor),
    social_id_hash: String(social_id_hash),
    pathElements,
    pathIndex,
    min_level: String(min_level),
    min_amount: String(min_amount),
    max_amount: String(max_amount),
    ts_start: String(ts_start),
    ts_end: String(ts_end),
    airdrop_project_id: String(airdrop_project_id),
    merkle_root: String(merkle_root),
    identity_commitment: String(identity_commitment),
    nullifier_hash: String(nullifier_hash),
    user_level: String(user_level),
    claim_amount: String(claim_amount),
    claim_ts: String(claim_ts),
    parameter_hash: String(parameter_hash),
    merkle_leaf: String(merkle_leaf),
  };
}
