/**
 * 将后端 Explorer API 的搜索结果映射为 Explorer Store 使用的 SearchResult
 */

import type { SearchResult, TxRecord, BlockSummary, AddressSummary, TxStatus } from '../../types/explorer';
import type { Block, Transaction, AddressInfo } from '../api/explorer';

function apiTransactionToTxRecord(tx: Transaction): TxRecord {
  let status: TxStatus = 'success';
  if (tx.status === 'pending') status = 'pending';
  else if (tx.status === 'failed') status = 'failed';

  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    blockTimestamp: tx.timestamp,
    from: tx.from,
    to: tx.to || '',
    value: BigInt(tx.value),
    gasUsed: BigInt(tx.gasUsed || '0'),
    gasPrice: BigInt(tx.gasPrice || '0'),
    status,
    txType: 'UNKNOWN',
    decodedInput: null,
    relatedClaimId: null,
    zkProofHash: null,
  };
}

function apiBlockToBlockSummary(b: Block): BlockSummary {
  return {
    number: b.number,
    hash: b.hash,
    parentHash: b.parentHash,
    timestamp: b.timestamp,
    txCount: b.transactionCount,
    gasUsed: BigInt(b.gasUsed || '0'),
    gasLimit: BigInt(b.gasLimit || '0'),
    miner: b.miner,
  };
}

function apiAddressToSummary(a: AddressInfo): AddressSummary {
  return {
    address: a.address,
    totalTx: a.transactionCount,
    label: a.isContract ? '合约' : undefined,
    firstTxTime: a.createdAt,
  };
}

export function mapExplorerApiSearchToSearchResult(raw: {
  type: 'block' | 'transaction' | 'address';
  result: Block | Transaction | AddressInfo;
}): SearchResult {
  switch (raw.type) {
    case 'transaction':
      return { type: 'transaction', data: apiTransactionToTxRecord(raw.result as Transaction) };
    case 'block':
      return { type: 'block', data: apiBlockToBlockSummary(raw.result as Block) };
    case 'address':
      return { type: 'address', data: apiAddressToSummary(raw.result as AddressInfo) };
    default:
      return { type: 'not_found' };
  }
}
