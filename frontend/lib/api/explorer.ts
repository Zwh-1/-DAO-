/**
 * Explorer API 服务
 *
 * 功能：
 * - 区块浏览器数据查询（对齐 `GET /v1/explorer/*`，见 `backend/src/routes/explorer.routes.js`）
 * - RPC 不可用时由后端返回空数据；前端 `lib/explorer/mock-data.ts` 仅作开发降级参考
 * - 支持分页和过滤
 * 
 * 数据范围：
 * - 区块列表和详情
 * - 交易列表和详情
 * - 地址信息和交易历史
 * - 统计信息
 * 
 * 隐私保护：
 * - 不记录敏感数据到日志
 * - 地址脱敏展示
 */

import { get } from './client';
import { API_ENDPOINTS } from './client';
import { V1Routes } from './v1Routes';

/**
 * 区块数据
 */
export interface Block {
  /** 区块号 */
  number: number;
  /** 区块哈希 */
  hash: string;
  /** 父哈希 */
  parentHash: string;
  /** 时间戳 */
  timestamp: number;
  /** 交易数量 */
  transactionCount: number;
  /** 矿工地址 */
  miner: string;
  /** Gas 使用量 */
  gasUsed: string;
  /** Gas 限制 */
  gasLimit: string;
  /** 难度 */
  difficulty: string;
  /** 总难度 */
  totalDifficulty: string;
  /** Size */
  size: number;
  /** Nonce */
  nonce: string;
}

/**
 * 交易数据
 */
export interface Transaction {
  /** 交易哈希 */
  hash: string;
  /** 区块号 */
  blockNumber: number;
  /** 区块哈希 */
  blockHash: string;
  /** 时间戳 */
  timestamp: number;
  /** 发送方 */
  from: string;
  /** 接收方 */
  to: string | null;
  /** 金额（Wei） */
  value: string;
  /** Gas 价格 */
  gasPrice: string;
  /** Gas 使用量 */
  gasUsed: string;
  /** 交易费用 */
  fee: string;
  /** Nonce */
  nonce: number;
  /** 交易索引 */
  transactionIndex: number;
  /** 输入数据 */
  input: string;
  /** 状态 */
  status: 'success' | 'failed' | 'pending';
  /** 错误信息 */
  errorMessage?: string;
  /** 方法 ID */
  methodId?: string;
  /** 方法名称 */
  methodName?: string;
}

/**
 * 地址数据
 */
export interface AddressInfo {
  /** 地址 */
  address: string;
  /** ETH 余额 */
  balance: string;
  /** 交易计数 */
  transactionCount: number;
  /** 是否为合约 */
  isContract: boolean;
  /** 合约创建者 */
  creator?: string;
  /** 合约创建时间 */
  createdAt?: number;
  /** 代币余额列表 */
  tokenBalances?: TokenBalance[];
}

/**
 * 代币余额
 */
export interface TokenBalance {
  /** 代币地址 */
  tokenAddress: string;
  /** 代币名称 */
  tokenName: string;
  /** 代币符号 */
  tokenSymbol: string;
  /** 代币精度 */
  tokenDecimals: number;
  /** 余额 */
  balance: string;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  /** 页码（从 1 开始） */
  page: number;
  /** 每页数量 */
  limit: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 总数量 */
  total: number;
  /** 页码 */
  page: number;
  /** 每页数量 */
  limit: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 获取区块列表
 * 
 * @param pagination 分页参数
 * @returns 区块列表
 */
export async function getBlocks(
  pagination: PaginationParams
): Promise<PaginatedResponse<Block>> {
  const endpoint = `${API_ENDPOINTS.explorer?.blocks || V1Routes.explorer.blocks}`;
  
  return get(endpoint, {
    params: {
      page: pagination.page,
      limit: pagination.limit,
    },
  });
}

/**
 * 获取区块详情
 * 
 * @param blockNumberOrHash 区块号或哈希
 * @returns 区块详情
 */
export async function getBlock(
  blockNumberOrHash: number | string
): Promise<Block> {
  const endpoint = `${API_ENDPOINTS.explorer?.blocks || V1Routes.explorer.blocks}/${blockNumberOrHash}`;
  return get(endpoint);
}

/**
 * 获取交易列表
 * 
 * @param pagination 分页参数
 * @returns 交易列表
 */
export async function getTransactions(
  pagination: PaginationParams
): Promise<PaginatedResponse<Transaction>> {
  const endpoint = `${API_ENDPOINTS.explorer?.transactions || V1Routes.explorer.transactions}`;

  return get(endpoint, {
    params: {
      page: pagination.page,
      limit: pagination.limit,
    },
  });
}

/**
 * 获取交易详情
 * 
 * @param txHash 交易哈希
 * @returns 交易详情
 */
export async function getTransaction(txHash: string): Promise<Transaction> {
  const endpoint = `${API_ENDPOINTS.explorer?.transactions || V1Routes.explorer.transactions}/${txHash}`;
  return get(endpoint);
}

/**
 * 获取地址信息
 * 
 * @param address 地址
 * @returns 地址信息
 */
export async function getAddressInfo(address: string): Promise<AddressInfo> {
  const endpoint = `${API_ENDPOINTS.explorer?.addresses || V1Routes.explorer.addresses}/${address}`;
  return get(endpoint);
}

/**
 * 获取地址交易历史
 * 
 * @param address 地址
 * @param pagination 分页参数
 * @returns 交易列表
 */
export async function getAddressTransactions(
  address: string,
  pagination: PaginationParams
): Promise<PaginatedResponse<Transaction>> {
  const endpoint = `${API_ENDPOINTS.explorer?.addresses || V1Routes.explorer.addresses}/${address}/transactions`;
  
  return get(endpoint, {
    params: {
      page: pagination.page,
      limit: pagination.limit,
    },
  });
}

/**
 * 获取统计信息
 * 
 * @returns 统计信息
 */
export async function getStats(): Promise<{
  /** 总区块数 */
  totalBlocks: number;
  /** 总交易数 */
  totalTransactions: number;
  /** 总地址数 */
  totalAddresses: number;
  /** 最新区块号 */
  latestBlockNumber: number;
  /** 平均 Gas 价格 */
  averageGasPrice: string;
  /** TPS */
  tps: number;
}> {
  const endpoint = API_ENDPOINTS.explorer?.stats || V1Routes.explorer.stats;
  return get(endpoint);
}

/**
 * 搜索（支持区块号、哈希、地址）
 * 
 * @param query 搜索关键词
 * @returns 搜索结果
 */
export async function search(query: string): Promise<{
  /** 类型 */
  type: 'block' | 'transaction' | 'address';
  /** 结果 */
  result: Block | Transaction | AddressInfo;
} | null> {
  const endpoint = API_ENDPOINTS.explorer?.search || V1Routes.explorer.search;
  
  return get(endpoint, {
    params: { q: query },
  });
}

/**
 * 导出 Explorer API
 */
export const explorerApi = {
  getBlocks,
  getBlock,
  getTransactions,
  getTransaction,
  getAddressInfo,
  getAddressTransactions,
  getStats,
  search,
};
