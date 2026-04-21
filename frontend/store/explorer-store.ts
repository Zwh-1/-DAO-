/**
 * Explorer 全局状态管理（Zustand）
 * 
 * 职责：
 * - 管理个人交易历史数据
 * - 管理全网事件列表
 * - 管理搜索结果
 * （网络统计由页面级 useExplorerStats + GET /v1/explorer/stats 负责，不放入本 store）
 * 
 * 隐私保护：
 * - 不存储私钥或助记词
 * - 不记录完整的 zk 证明数据
 * - 日志脱敏处理
 */

import { create } from 'zustand';
import type {
  ExplorerStore,
  ExplorerState,
  ExplorerActions,
  TxHistoryOptions,
  NetworkEventsOptions,
} from '../types/explorer';

// ============ 初始状态 ============

const initialState: ExplorerState = {
  connectedAddress: null,
  personalTxHistory: [],
  networkEvents: [],
  searchResult: null,
  isLoading: false,
  error: null,
  txHistoryCursor: null,
  networkEventsCursor: null,
};

// ============ 创建 Store ============

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  ...initialState,

  // 设置连接的钱包地址
  setConnectedAddress: (address) => {
    console.log('[Explorer] 钱包地址已设置:', address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'null');
    set({ connectedAddress: address });
  },

  // 加载个人交易历史
  loadPersonalTxHistory: async (address, options = {}) => {
    const { pageSize = 20, cursor = null, filterType = [] } = options;
    
    set({ isLoading: true, error: null });
    
    try {
      console.log('[Explorer] 加载个人交易历史:', {
        address: address.slice(0, 6) + '...' + address.slice(-4),
        pageSize,
        cursor,
        filterType,
      });
      
      // 调用 Explorer API
      const { explorerApi } = await import('../lib/api/explorer');
      const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
      const result = await explorerApi.getAddressTransactions(address, {
        page,
        limit: pageSize,
      });
      
      // 转换为内部格式
      const txHistory = result.data.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: BigInt(tx.value),
        timestamp: tx.timestamp,
        blockNumber: tx.blockNumber,
        blockTimestamp: tx.timestamp, // 使用相同的时间戳
        gasUsed: BigInt(21000), // 默认值
        gasPrice: BigInt(20000000000), // 默认值
        status: tx.status,
        txType: 'MEMBER_REGISTER' as const, // 使用合法的 TxType
        decodedInput: null,
        relatedClaimId: null,
        zkProofHash: null,
      }));
      
      set((state) => ({
        personalTxHistory: cursor ? [...state.personalTxHistory, ...txHistory] : txHistory,
        txHistoryCursor:
          result.page < result.totalPages ? String(result.page + 1) : null,
        isLoading: false,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败';
      console.error('[Explorer] 加载交易历史失败:', errorMessage);
      set({ error: errorMessage, isLoading: false });
    }
  },

  // 加载全网事件
  loadNetworkEvents: async (options = {}) => {
    const { eventNames = [], fromBlock = 'latest-500', pageSize = 30, cursor = null } = options;
    
    set({ isLoading: true, error: null });
    
    try {
      console.log('[Explorer] 加载全网事件:', {
        eventNames: eventNames.length > 0 ? eventNames : 'all',
        fromBlock,
        pageSize,
        cursor,
      });
      
      // 调用 Explorer API
      const { explorerApi } = await import('../lib/api/explorer');
      const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
      const result = await explorerApi.getTransactions({
        page,
        limit: pageSize,
      });
      
      // 转换为内部格式
      const events = result.data.map((tx, index) => ({
        eventId: `${tx.blockNumber}-${index}`,
        eventName: tx.methodName || 'Transfer',
        contractName: 'UnknownContract',
        contractAddress: tx.to || '0x0000000000000000000000000000000000000000',
        blockNumber: tx.blockNumber,
        blockTimestamp: tx.timestamp,
        txHash: tx.hash,
        args: { hash: tx.hash },
        displaySummary: `${tx.methodName || 'Transfer'} at block ${tx.blockNumber}`,
        severity: 'info' as const, // 使用合法的 EventSeverity
      }));
      
      set((state) => ({
        networkEvents: cursor ? [...state.networkEvents, ...events] : events,
        networkEventsCursor: result.page < result.totalPages ? String(result.page + 1) : null,
        isLoading: false,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载失败';
      console.error('[Explorer] 加载全网事件失败:', errorMessage);
      set({ error: errorMessage, isLoading: false });
    }
  },

  // 执行搜索
  search: async (query) => {
    const q = query.trim();
    set({ isLoading: true, error: null });

    if (!q) {
      set({ searchResult: { type: 'not_found' }, isLoading: false });
      return;
    }

    try {
      console.log('[Explorer] 执行搜索:', q);

      const { explorerApi } = await import('../lib/api/explorer');
      const { mapExplorerApiSearchToSearchResult } = await import('../lib/explorer/search-mappers');
      const { searchRpcFallback } = await import('../lib/explorer/explorer-service');

      let searchResult = null;
      try {
        searchResult = await explorerApi.search(q);
      } catch {
        searchResult = null;
      }

      if (searchResult) {
        set({
          searchResult: mapExplorerApiSearchToSearchResult(searchResult),
          isLoading: false,
        });
        return;
      }

      const rpcResult = await searchRpcFallback(q);
      set({ searchResult: rpcResult, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索失败';
      console.error('[Explorer] 搜索失败:', errorMessage);
      set({ error: errorMessage, isLoading: false });
    }
  },

  // 清除搜索结果
  clearSearch: () => {
    set({ searchResult: null });
  },

  // 加载更多交易历史
  loadMoreTxHistory: async () => {
    const { connectedAddress, txHistoryCursor } = get();
    
    if (!connectedAddress) {
      set({ error: '请先连接钱包' });
      return;
    }
    
    if (txHistoryCursor) {
      await get().loadPersonalTxHistory(connectedAddress, {
        cursor: txHistoryCursor,
      });
    }
  },

  // 加载更多网络事件
  loadMoreNetworkEvents: async () => {
    const { networkEventsCursor } = get();
    
    if (networkEventsCursor) {
      await get().loadNetworkEvents({
        cursor: networkEventsCursor,
      });
    }
  },

  // 设置错误
  setError: (error) => {
    set({ error });
  },

  // 清除所有数据
  clearAll: () => {
    console.log('[Explorer] 清除所有数据');
    set(initialState);
  },
}));

// ============ 快捷选择器 ============

/**
 * 选择器：个人交易历史
 */
export const selectPersonalTxHistory = (state: ExplorerState) => state.personalTxHistory;

/**
 * 选择器：全网事件
 */
export const selectNetworkEvents = (state: ExplorerState) => state.networkEvents;

/**
 * 选择器：搜索结果
 */
export const selectSearchResult = (state: ExplorerState) => state.searchResult;

/**
 * 选择器：加载状态
 */
export const selectIsLoading = (state: ExplorerState) => state.isLoading;

/**
 * 选择器：错误信息
 */
export const selectError = (state: ExplorerState) => state.error;
