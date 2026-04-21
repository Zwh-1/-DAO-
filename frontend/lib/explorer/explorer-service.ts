/**
 * TrustAid Explorer 服务层
 *
 * 职责：
 * - 统一封装所有数据获取逻辑
 * - 屏蔽 Indexer API 与 RPC 直查的实现差异
 * - 提供错误处理和重试机制
 *
 * 数据源优先级：
 * 1. Indexer API（主路径，低延迟、数据完整）
 * 2. RPC 直查（降级路径，受节点能力与区块范围限制）
 *
 * 隐私保护：
 * - 不请求或记录用户私钥
 * - zk 证明数据脱敏处理
 * - 日志地址脱敏
 */

import {
  JsonRpcProvider,
  getAddress,
  isAddress,
  type Block,
  type TransactionReceipt,
  type TransactionResponse,
} from 'ethers';
import { getAllContractAddresses, getDefaultChainId } from '../contracts/addresses';
import type {
  TxRecord,
  ChainEvent,
  NetworkStats,
  SearchResult,
  TxHistoryOptions,
  NetworkEventsOptions,
  TxHistoryResponse,
  NetworkEventsResponse,
  TxStatus,
} from '../../types/explorer';

// ============ 配置常量 ============

const INDEXER_API_BASE_URL = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3001/api';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545';

const MAX_RPC_BLOCK_RANGE = 500;

const REQUEST_TIMEOUT = 10000;

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

// ============ 工具函数 ============

function sanitizeAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getJsonRpcProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function transactionResponseToTxRecord(
  tx: TransactionResponse,
  receipt: TransactionReceipt | null,
  block: Block | null
): TxRecord {
  let status: TxStatus = 'pending';
  if (receipt) {
    status = receipt.status === 1 ? 'success' : 'failed';
  }
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    blockTimestamp: block ? Number(block.timestamp) : null,
    from: tx.from,
    to: tx.to || '',
    value: tx.value,
    gasUsed: receipt?.gasUsed ?? null,
    gasPrice: tx.gasPrice ?? 0n,
    status,
    txType: 'UNKNOWN',
    decodedInput: null,
    relatedClaimId: null,
    zkProofHash: null,
  };
}

function blockToBlockSummary(block: Block) {
  const txs = block.transactions;
  const txCount = Array.isArray(txs) ? txs.length : 0;
  return {
    number: block.number,
    hash: block.hash || '',
    parentHash: block.parentHash,
    timestamp: Number(block.timestamp),
    txCount,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    miner: block.miner,
  };
}

/**
 * Indexer 不可用时，通过 RPC 按哈希 / 地址 / 区块号搜索（仅基础字段）
 */
export async function searchRpcFallback(query: string): Promise<SearchResult> {
  const provider = getJsonRpcProvider();
  const q = query.trim();

  try {
    if (TX_HASH_RE.test(q)) {
      const tx = await provider.getTransaction(q);
      if (!tx) return { type: 'not_found' };
      const [receipt, block] = await Promise.all([
        provider.getTransactionReceipt(q),
        tx.blockNumber != null ? provider.getBlock(tx.blockNumber) : Promise.resolve(null),
      ]);
      return { type: 'transaction', data: transactionResponseToTxRecord(tx, receipt, block) };
    }

    if (isAddress(q)) {
      const checksum = getAddress(q);
      const [code, txCount] = await Promise.all([
        provider.getCode(checksum),
        provider.getTransactionCount(checksum),
      ]);
      return {
        type: 'address',
        data: {
          address: checksum,
          totalTx: txCount,
          label: code !== '0x' ? '合约' : undefined,
        },
      };
    }

    if (/^\d+$/.test(q)) {
      const num = parseInt(q, 10);
      if (num < 0) return { type: 'not_found' };
      const block = await provider.getBlock(num);
      if (!block) return { type: 'not_found' };
      return { type: 'block', data: blockToBlockSummary(block) };
    }
  } catch {
    /* fall through */
  }

  return { type: 'not_found' };
}

async function getTxHistoryByRPC(
  address: string,
  fromBlock: number,
  toBlock: number
): Promise<TxRecord[]> {
  const provider = getJsonRpcProvider();
  const lower = address.toLowerCase();
  const records: TxRecord[] = [];
  const safeFrom = Math.max(fromBlock, 0);
  const safeTo = Math.max(safeFrom, toBlock);
  const span = Math.min(safeTo - safeFrom + 1, MAX_RPC_BLOCK_RANGE);
  const startBlock = Math.max(safeFrom, safeTo - span + 1);

  for (let b = safeTo; b >= startBlock && records.length < 80; b--) {
    const block = await provider.getBlock(b, true);
    if (!block) continue;

    const txs = block.transactions as (TransactionResponse | string)[];
    for (const tx of txs) {
      if (typeof tx === 'string') continue;
      if (tx.from?.toLowerCase() === lower || (tx.to && tx.to.toLowerCase() === lower)) {
        const receipt = await provider.getTransactionReceipt(tx.hash).catch(() => null);
        records.push(transactionResponseToTxRecord(tx, receipt, block));
        if (records.length >= 80) break;
      }
    }
  }

  return records;
}

async function getNetworkEventsByRPC(fromBlock: number, toBlock: number): Promise<ChainEvent[]> {
  const provider = getJsonRpcProvider();
  let addresses: string[] = [];
  try {
    const all = getAllContractAddresses(getDefaultChainId());
    addresses = Object.values(all).filter(
      (a): a is `0x${string}` =>
        Boolean(a) && a !== '0x0000000000000000000000000000000000000000'
    );
  } catch {
    addresses = [];
  }
  if (addresses.length === 0) return [];

  const span = Math.min(toBlock - fromBlock + 1, MAX_RPC_BLOCK_RANGE);
  const start = Math.max(fromBlock, toBlock - span + 1);
  const events: ChainEvent[] = [];

  for (const addr of addresses) {
    const logs = await provider.getLogs({
      address: addr,
      fromBlock: start,
      toBlock,
    });
    const slice = logs.slice(-40);
    for (const log of slice) {
      const block = await provider.getBlock(log.blockNumber).catch(() => null);
      events.push({
        eventId: `${log.blockNumber}-${log.index}`,
        eventName: log.topics[0]?.slice(0, 18) || 'Log',
        contractName: 'OnChain',
        contractAddress: log.address,
        blockNumber: log.blockNumber,
        blockTimestamp: block ? Number(block.timestamp) : 0,
        txHash: log.transactionHash,
        args: { topic0: log.topics[0] },
        displaySummary: `链上日志 · 区块 ${log.blockNumber}`,
        severity: 'info',
      });
    }
  }

  return events.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 40);
}

function resolveFromBlock(latest: number, fromBlock?: NetworkEventsOptions['fromBlock']): number {
  if (typeof fromBlock === 'number' && Number.isFinite(fromBlock)) {
    return Math.max(0, fromBlock);
  }
  if (typeof fromBlock === 'string' && fromBlock.startsWith('latest-')) {
    const n = parseInt(fromBlock.slice('latest-'.length), 10);
    if (Number.isFinite(n)) return Math.max(0, latest - n);
  }
  return Math.max(0, latest - 499);
}

// ============ 核心 API 函数 ============

export async function getPersonalTxHistory(
  address: string,
  options: TxHistoryOptions = {}
): Promise<TxHistoryResponse> {
  console.log('[Explorer Service] 获取个人交易历史:', {
    address: sanitizeAddress(address),
    options,
  });

  try {
    const url = new URL(`${INDEXER_API_BASE_URL}/tx-history/${address}`);
    url.searchParams.set('pageSize', String(options.pageSize || 20));

    if (options.cursor) {
      url.searchParams.set('cursor', options.cursor);
    }

    if (options.filterType && options.filterType.length > 0) {
      url.searchParams.set('filterType', options.filterType.join(','));
    }

    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      throw new Error(`Indexer API 返回错误：${response.status}`);
    }

    const data = await response.json();
    return data as TxHistoryResponse;
  } catch (error) {
    console.warn('[Explorer Service] Indexer API 失败，降级至 RPC 直查:', error);

    try {
      const provider = getJsonRpcProvider();
      const latest = await provider.getBlockNumber();
      const items = await getTxHistoryByRPC(
        address,
        Math.max(0, latest - MAX_RPC_BLOCK_RANGE + 1),
        latest
      );
      return {
        items,
        nextCursor: null,
        total: items.length,
      };
    } catch {
      return {
        items: [],
        nextCursor: null,
        total: 0,
      };
    }
  }
}

export async function getNetworkEvents(
  options: NetworkEventsOptions = {}
): Promise<NetworkEventsResponse> {
  console.log('[Explorer Service] 获取全网事件:', options);

  try {
    const url = new URL(`${INDEXER_API_BASE_URL}/network-events`);

    if (options.eventNames && options.eventNames.length > 0) {
      url.searchParams.set('eventNames', options.eventNames.join(','));
    }

    if (options.fromBlock !== undefined) {
      url.searchParams.set('fromBlock', String(options.fromBlock));
    }

    if (options.pageSize) {
      url.searchParams.set('pageSize', String(options.pageSize));
    }

    if (options.cursor) {
      url.searchParams.set('cursor', options.cursor);
    }

    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      throw new Error(`Indexer API 返回错误：${response.status}`);
    }

    const data = await response.json();
    return data as NetworkEventsResponse;
  } catch (error) {
    console.warn('[Explorer Service] Indexer API 失败，降级至 RPC 直查:', error);

    try {
      const provider = getJsonRpcProvider();
      const latest = await provider.getBlockNumber();
      const from = resolveFromBlock(latest, options.fromBlock);
      const items = await getNetworkEventsByRPC(from, latest);
      return {
        items,
        nextCursor: null,
      };
    } catch {
      return {
        items: [],
        nextCursor: null,
      };
    }
  }
}

export async function getNetworkStats(): Promise<NetworkStats> {
  console.log('[Explorer Service] 获取网络统计');

  try {
    const url = `${INDEXER_API_BASE_URL}/network-stats`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Indexer API 返回错误：${response.status}`);
    }

    const data = await response.json();
    return data as NetworkStats;
  } catch (error) {
    console.warn('[Explorer Service] Indexer API 失败，降级至 RPC 直查:', error);

    try {
      const provider = getJsonRpcProvider();
      const latestBlock = await provider.getBlockNumber();
      return {
        latestBlock,
        rpcStatus: 'degraded',
        pendingTxCount: 0,
        todayEventCount: 0,
      };
    } catch {
      return {
        latestBlock: 0,
        rpcStatus: 'offline',
        pendingTxCount: 0,
        todayEventCount: 0,
      };
    }
  }
}

export async function searchByHashOrAddress(query: string): Promise<SearchResult> {
  const q = query.trim();
  console.log('[Explorer Service] 搜索:', q);

  try {
    const url = new URL(`${INDEXER_API_BASE_URL}/search/${encodeURIComponent(q)}`);
    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      if (response.status === 404) {
        return searchRpcFallback(q);
      }
      throw new Error(`搜索 API 返回错误：${response.status}`);
    }

    const data = await response.json();
    return data as SearchResult;
  } catch (error) {
    console.warn('[Explorer Service] Indexer 搜索不可用，降级 RPC:', error);
    return searchRpcFallback(q);
  }
}

export const explorerService = {
  getPersonalTxHistory,
  getNetworkEvents,
  getNetworkStats,
  searchByHashOrAddress,
  searchRpcFallback,
};
