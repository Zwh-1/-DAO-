/**
 * 十条核心电路元数据（与 circuits/src/*.circom 的 public 个数一致）
 * vkey 默认路径：{ZK_CIRCUITS_BUILD_DIR}/{circuitName}/vkey.json
 */

import path from "path";
import { config } from "../config.js";

/** 默认：仓库 trustaid-platform/circuits/build（须在 backend 目录下启动） */
const DEFAULT_BUILD_DIR = path.resolve(process.cwd(), "..", "circuits", "build");

export function getCircuitsBuildDir() {
  const d = config.zkCircuitsBuildDir?.trim();
  return d ? path.resolve(d) : DEFAULT_BUILD_DIR;
}

export function vkeyPathFor(circuitName) {
  return path.join(getCircuitsBuildDir(), circuitName, "vkey.json");
}

/** @type {Record<string, { nPublic: number, label: string }>} */
export const CIRCUIT_META = {
  identity_commitment: { nPublic: 2, label: "social_id_hash+identity_commitment" },
  anti_sybil_claim: { nPublic: 3, label: "anti_sybil_claim" },
  anonymous_claim: { nPublic: 7, label: "anonymous_claim" },
  anti_sybil_verifier: { nPublic: 8, label: "anti_sybil_verifier" },
  confidential_transfer: { nPublic: 5, label: "confidential_transfer" },
  multi_sig_proposal: { nPublic: 3, label: "multi_sig_proposal" },
  privacy_payment: { nPublic: 4, label: "privacy_payment" },
  reputation_verifier: { nPublic: 2, label: "reputation_verifier" },
  history_anchor: { nPublic: 2, label: "history_anchor" },
  private_payment: { nPublic: 4, label: "private_payment" },
  // 治理 / 审计模块
  delegate_vote_weight: { nPublic: 5, label: "from_hash+to_hash+delegated_weight+delegation_id+min_weight" },
  anonymous_vote:       { nPublic: 6, label: "proposal_id+merkle_root+nullifier+support+weight+min_credit" },
  fraud_detection:      { nPublic: 4, label: "risk_score_hash+threshold+audit_epoch+is_fraud" },
  arb_commit_zk:        { nPublic: 5, label: "proposal_id+commitment+arbitrator_hash+phase+revealed_vote" },
};

export const CORE_CIRCUIT_NAMES = Object.keys(CIRCUIT_META);
