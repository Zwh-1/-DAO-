import { parseFieldElement } from './fieldScalar';

export type PrivacyPaymentCircuitInput = {
  balance: string;
  salt: string;
  required_amount: string;
  nullifier_id: string;
  balance_commitment: string;
  nullifier: string;
};

export function buildPrivacyPaymentCircuitInput(p: {
  balance: string;
  salt: string;
  requiredAmount: string;
  nullifierId: string;
  balanceCommitment: string;
  nullifier: string;
}): PrivacyPaymentCircuitInput {
  return {
    balance: String(parseFieldElement(p.balance)),
    salt: String(parseFieldElement(p.salt)),
    required_amount: String(parseFieldElement(p.requiredAmount)),
    nullifier_id: String(parseFieldElement(p.nullifierId)),
    balance_commitment: String(parseFieldElement(p.balanceCommitment)),
    nullifier: String(parseFieldElement(p.nullifier)),
  };
}
