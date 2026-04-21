/**
 * 匿名申领：本地 fullProve + POST /v1/anonymous-claim/claim
 *
 * publicSignals 顺序（与 AnonymousClaim.sol 一致）：
 *   [0] merkle_root [1] nullifier [2] commitment [3] claim_amount
 *   [4] current_timestamp [5] ts_start [6] ts_end
 */

import { useState, useCallback } from 'react';
import { generateProof } from '../lib/zk/snarkjs';
import type { Groth16Proof } from 'snarkjs';
import { anonymousClaimApi, type ZKProof } from '../lib/api/anonymousClaim';
import {
  buildAnonymousClaimCircuitInput,
} from '../lib/zk/anonymousClaimWitness';

export interface ProofGenerationState {
  isGenerating: boolean;
  isGenerated: boolean;
  error: string | null;
  proofTime: number | null;
}

/** 与 anonymous_claim.circom 一致的 witness / 公开输入参数 */
export interface AnonymousClaimProofParams {
  secret: string;
  airdropId: string;
  leafIndex: number;
  merklePath: string[];
  merkleRoot: string;
  claimAmountWei: string;
  currentTimestamp: string;
  tsStart: string;
  tsEnd: string;
}

export interface GenerateAndSubmitOptions {
  wasmPath: string;
  zkeyPath: string;
  recipient: string;
}

const DEFAULT_WASM =
  process.env.NEXT_PUBLIC_ANONYMOUS_CLAIM_WASM_PATH || '/circuits/build/anonymous_claim.wasm';
const DEFAULT_ZKEY =
  process.env.NEXT_PUBLIC_ANONYMOUS_CLAIM_ZKEY_PATH || '/circuits/build/anonymous_claim_final.zkey';

function groth16ProofToApi(p: Groth16Proof): ZKProof {
  const s = (v: unknown) => String(v);
  return {
    pi_a: [s(p.pi_a[0]), s(p.pi_a[1]), s(p.pi_a[2])],
    pi_b: [
      [s(p.pi_b[0][0]), s(p.pi_b[0][1])],
      [s(p.pi_b[1][0]), s(p.pi_b[1][1])],
    ],
    pi_c: [s(p.pi_c[0]), s(p.pi_c[1]), s(p.pi_c[2])],
  };
}

export function useAnonymousClaimProof() {
  const [state, setState] = useState<ProofGenerationState>({
    isGenerating: false,
    isGenerated: false,
    error: null,
    proofTime: null,
  });

  const generateAndSubmit = useCallback(
    async (
      params: AnonymousClaimProofParams,
      options: GenerateAndSubmitOptions
    ): Promise<{ success: boolean; txHash?: string; nullifier?: string; mode?: string } | null> => {
      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      const wasmPath = options.wasmPath || DEFAULT_WASM;
      const zkeyPath = options.zkeyPath || DEFAULT_ZKEY;

      try {
        const circuitInput = await buildAnonymousClaimCircuitInput({
          secret: params.secret,
          airdropId: params.airdropId,
          leafIndex: params.leafIndex,
          merklePath: params.merklePath,
          merkleRoot: params.merkleRoot,
          claimAmountWei: params.claimAmountWei,
          currentTimestamp: params.currentTimestamp,
          tsStart: params.tsStart,
          tsEnd: params.tsEnd,
        });

        const { proof, publicSignals, proofTime } = await generateProof(wasmPath, zkeyPath, circuitInput);

        const formattedProof = groth16ProofToApi(proof);

        const pubSignals = publicSignals.map((s) => String(s));
        const nullifierFromSignals = pubSignals[1];

        const result = await anonymousClaimApi.claim({
          recipient: options.recipient,
          amount: params.claimAmountWei,
          nullifier: nullifierFromSignals,
          proof: formattedProof,
          pubSignals,
        });

        setState({
          isGenerating: false,
          isGenerated: true,
          error: null,
          proofTime,
        });

        return {
          success: Boolean(result.success),
          txHash: result.txHash,
          nullifier: result.nullifier ?? nullifierFromSignals,
          mode: result.mode,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '证明生成或提交失败';
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: errorMessage,
        }));
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      isGenerated: false,
      error: null,
      proofTime: null,
    });
  }, []);

  return {
    ...state,
    generateAndSubmit,
    reset,
    defaultWasmPath: DEFAULT_WASM,
    defaultZkeyPath: DEFAULT_ZKEY,
  };
}

export default useAnonymousClaimProof;
