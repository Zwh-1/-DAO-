import { parseFieldElement } from './fieldScalar';

export type ConfidentialTransferCircuitInput = {
  amount: string;
  salt: string;
  min_amount: string;
  max_amount: string;
  transaction_id: string;
  amount_commitment: string;
  nullifier: string;
};

export function buildConfidentialTransferCircuitInput(p: {
  amount: string;
  salt: string;
  minAmount: string;
  maxAmount: string;
  transactionId: string;
  amountCommitment: string;
  nullifier: string;
}): ConfidentialTransferCircuitInput {
  return {
    amount: String(parseFieldElement(p.amount)),
    salt: String(parseFieldElement(p.salt)),
    min_amount: String(parseFieldElement(p.minAmount)),
    max_amount: String(parseFieldElement(p.maxAmount)),
    transaction_id: String(parseFieldElement(p.transactionId)),
    amount_commitment: String(parseFieldElement(p.amountCommitment)),
    nullifier: String(parseFieldElement(p.nullifier)),
  };
}
