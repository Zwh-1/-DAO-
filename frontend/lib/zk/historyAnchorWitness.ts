import { parseFieldElement } from './fieldScalar';

const DEPTH = 20;

export type HistoryAnchorCircuitInput = {
  history_data: string;
  history_index: string;
  merkle_path: string[];
  merkle_root: string;
  history_hash: string;
};

export function buildHistoryAnchorCircuitInput(p: {
  historyData: string;
  historyIndex: number;
  merklePath: string[];
  merkleRoot: string;
  historyHash: string;
}): HistoryAnchorCircuitInput {
  const path = p.merklePath.map((x) => String(parseFieldElement(x)));
  if (path.length !== DEPTH) throw new Error(`merklePath must have length ${DEPTH}`);
  return {
    history_data: String(parseFieldElement(p.historyData)),
    history_index: String(p.historyIndex),
    merkle_path: path,
    merkle_root: String(parseFieldElement(p.merkleRoot)),
    history_hash: String(parseFieldElement(p.historyHash)),
  };
}
