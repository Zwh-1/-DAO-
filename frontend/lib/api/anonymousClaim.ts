/**
 * 匿名空投申领 API（主路径：POST /v1/anonymous-claim/claim）
 *
 * 与 backend anonymousClaim.routes.js 对齐；不记录 witness。
 */

import { get, post } from './client';
import { V1Routes } from './v1Routes';

/** snarkjs Groth16 证明（与链上 pA/pB/pC 对应） */
export interface ZKProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

export interface AnonymousClaimSubmitPayload {
  recipient: string;
  amount: string;
  nullifier: string;
  proof: ZKProof;
  pubSignals: string[];
}

export interface AnonymousClaimSubmitResult {
  success: boolean;
  txHash?: string;
  nullifier?: string;
  amount?: string;
  recipient?: string;
  mode?: string;
}

export interface AnonymousClaimStatus {
  address: string | null;
  totalBalance: string | null;
  totalClaimed: string | null;
  claimCount: string | null;
  remainingBalance?: string;
  merkleRoot?: string;
  tsStart?: string;
  tsEnd?: string;
  source: string;
  offchainMerkleRoot?: string | null;
}

export interface MerkleProofResponse {
  leafIndex: number;
  merkleRoot: string;
  pathElements: string[];
  pathIndices: number[];
  leaf: string;
}

export interface RegisterCommitmentResult {
  success: boolean;
  leafIndex: number;
  merkleRoot: string;
  alreadyExists: boolean;
}

export const anonymousClaimApi = {
  async getStatus(): Promise<AnonymousClaimStatus> {
    return get<AnonymousClaimStatus>(V1Routes.anonymousClaim.status);
  },

  async getMerkleRoot(): Promise<{ merkleRoot: string }> {
    return get<{ merkleRoot: string }>(V1Routes.anonymousClaim.merkleRoot);
  },

  /**
   * 根据 commitment 获取 Merkle 路径与 leafIndex（用于本地 witness）
   */
  async postMerkleProof(commitment: string): Promise<MerkleProofResponse> {
    return post<MerkleProofResponse>(
      V1Routes.anonymousClaim.merkleProof,
      { commitment },
      { requiresAuth: false }
    );
  },

  /**
   * 注册 commitment 叶子（限流；测试或白名单流程）
   */
  async registerCommitment(commitment: string): Promise<RegisterCommitmentResult> {
    return post<RegisterCommitmentResult>(
      V1Routes.anonymousClaim.registerCommitment,
      { commitment },
      { requiresAuth: false }
    );
  },

  /**
   * 提交匿名申领（ZK 证明 + 7 个公开信号）
   */
  async claim(payload: AnonymousClaimSubmitPayload): Promise<AnonymousClaimSubmitResult> {
    return post<AnonymousClaimSubmitResult>(
      V1Routes.anonymousClaim.claim,
      payload,
      { requiresAuth: false }
    );
  },

  async isNullifierUsed(nullifier: string): Promise<{ nullifier: string; used: boolean }> {
    return get<{ nullifier: string; used: boolean }>(
      V1Routes.anonymousClaim.nullifier(nullifier),
    );
  },
};

export default anonymousClaimApi;
