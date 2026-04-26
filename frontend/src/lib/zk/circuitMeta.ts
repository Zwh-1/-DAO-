/**
 * 十条核心电路元数据（与 backend/src/zk/circuitRegistry.js 及 circom public 声明对齐）
 */

export const CIRCUIT_N_PUBLIC: Record<string, number> = {
  identity_commitment: 2,
  anti_sybil_claim: 3,
  anonymous_claim: 7,
  anti_sybil_verifier: 8,
  confidential_transfer: 5,
  multi_sig_proposal: 3,
  privacy_payment: 4,
  reputation_verifier: 2,
  history_anchor: 2,
  private_payment: 4,
};

export const CORE_CIRCUIT_NAMES = Object.keys(CIRCUIT_N_PUBLIC) as (keyof typeof CIRCUIT_N_PUBLIC)[];

export type CoreCircuitName = (typeof CORE_CIRCUIT_NAMES)[number];

export function defaultWasmUrl(circuit: string): string {
  return `/circuits/build/${circuit}.wasm`;
}

export function defaultZkeyUrl(circuit: string): string {
  return `/circuits/build/${circuit}_final.zkey`;
}
