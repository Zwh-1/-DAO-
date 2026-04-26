/**
 * 十条电路 witness 输入构造入口（与 circuits/src 中 signal input 名称对齐）。
 */

export * from "./fieldScalar";
export * from "./anonymousClaimWitness";
export * from "./antiSybilVerifierWitness";
export * from "./antiSybilClaimWitness";
export * from "./identityCommitmentWitness";
export * from "./confidentialTransferWitness";
export * from "./multiSigProposalWitness";
export * from "./privacyPaymentWitness";
export * from "./privatePaymentWitness";
export * from "./reputationVerifierWitness";
export * from "./historyAnchorWitness";
export * from "./circuitMeta";

export type CircuitName =
  | "identity_commitment"
  | "anti_sybil_claim"
  | "anonymous_claim"
  | "anti_sybil_verifier"
  | "confidential_transfer"
  | "multi_sig_proposal"
  | "privacy_payment"
  | "reputation_verifier"
  | "history_anchor"
  | "private_payment";
