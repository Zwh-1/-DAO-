import { parseFieldElement } from './fieldScalar';

const DEPTH = 20;

function pad20(arr: string[], name: string): string[] {
  const a = arr.map((x) => String(parseFieldElement(x)));
  if (a.length !== DEPTH) throw new Error(`${name} must have length ${DEPTH}`);
  return a;
}

export type PrivatePaymentCircuitInput = {
  old_balance: string;
  new_balance: string;
  amount: string;
  balance_index: string;
  old_path: string[];
  new_path: string[];
  secret: string;
  old_root: string;
  new_root: string;
  transaction_id: string;
  nullifier: string;
};

export function buildPrivatePaymentCircuitInput(p: {
  oldBalance: string;
  newBalance: string;
  amount: string;
  balanceIndex: number;
  oldPath: string[];
  newPath: string[];
  secret: string;
  oldRoot: string;
  newRoot: string;
  transactionId: string;
  nullifier: string;
}): PrivatePaymentCircuitInput {
  return {
    old_balance: String(parseFieldElement(p.oldBalance)),
    new_balance: String(parseFieldElement(p.newBalance)),
    amount: String(parseFieldElement(p.amount)),
    balance_index: String(p.balanceIndex),
    old_path: pad20(p.oldPath, 'oldPath'),
    new_path: pad20(p.newPath, 'newPath'),
    secret: String(parseFieldElement(p.secret)),
    old_root: String(parseFieldElement(p.oldRoot)),
    new_root: String(parseFieldElement(p.newRoot)),
    transaction_id: String(parseFieldElement(p.transactionId)),
    nullifier: String(parseFieldElement(p.nullifier)),
  };
}
