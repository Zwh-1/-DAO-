/**
 * TrustAid Explorer 类型定义文件
 * 
 * 覆盖范围：
 * - 交易记录模型（TxRecord）
 * - 链上事件模型（ChainEvent）
 * - 枚举类型（TxStatus, TxType, EventSeverity）
 * - 搜索结果类型
 * - API 响应类型
 * 
 * 安全规范：
 * - 所有地址类型必须为 0x 开头的十六进制字符串
 * - 哈希值必须为 0x 开头的 64 字符十六进制字符串
 * - 禁止在类型定义中包含私钥或助记词字段
 */

// ============ 枚举类型 ============

/**
 * 交易状态枚举
 */
export type TxStatus = 'pending' | 'success' | 'failed';

/**
 * 语义化交易类型枚举
 * 
 * 对应合约函数调用：
 * - CLAIM_SUBMIT: ClaimContract.submitClaim()
 * - CLAIM_VOTE: DAOContract.vote()
 * - GUARDIAN_STAKE: MemberContract.stake()
 * - 等
 */
export type TxType =
  | 'CLAIM_SUBMIT'
  | 'CLAIM_VOTE'
  | 'CLAIM_APPROVED'
  | 'CLAIM_REJECTED'
  | 'GUARDIAN_STAKE'
  | 'GUARDIAN_UNSTAKE'
  | 'GUARDIAN_SLASHED'
  | 'MEMBER_REGISTER'
  | 'PROPOSAL_CREATE'
  | 'PROPOSAL_EXECUTE'
  | 'TOKEN_TRANSFER'
  | 'ZK_PROOF_VERIFY'
  | 'UNKNOWN';

/**
 * 事件严重程度枚举
 * 用于 UI 高亮展示
 */
export type EventSeverity = 'info' | 'warning' | 'critical';

// ============ 核心数据模型 ============

/**
 * ABI 解码后的输入数据
 */
export interface DecodedInput {
  /** 调用的函数名 */
  functionName: string;
  /** 函数参数列表 */
  params: Array<{
    name: string;
    type: string;
    value: string | number | bigint;
  }>;
  /** 原始 input data（十六进制） */
  inputData: string;
}

/**
 * 交易记录模型（TxRecord）
 * 
 * 对应文档：4.1 交易记录模型
 */
export interface TxRecord {
  /** 交易哈希（唯一主键，0x 开头 66 位字符串） */
  hash: string;
  
  /** 所在区块高度；pending 状态时为 null */
  blockNumber: number | null;
  
  /** 区块时间戳（Unix 秒）；pending 时为 null */
  blockTimestamp: number | null;
  
  /** 发送方地址 */
  from: string;
  
  /** 接收方地址（合约地址） */
  to: string;
  
  /** 转账金额（wei 单位） */
  value: bigint;
  
  /** 实际消耗 Gas 量；未确认时为 null */
  gasUsed: bigint | null;
  
  /** Gas 单价（wei 单位） */
  gasPrice: bigint;
  
  /** 交易状态 */
  status: TxStatus;
  
  /** 语义化交易类型 */
  txType: TxType;
  
  /** ABI 解码后的函数名与参数列表 */
  decodedInput: DecodedInput | null;
  
  /** 关联的互助申请 ID（如适用） */
  relatedClaimId: string | null;
  
  /** 关联的 zk 证明摘要哈希（如适用，脱敏处理） */
  zkProofHash: string | null;
}

/**
 * 链上事件模型（ChainEvent）
 * 
 * 对应文档：4.2 链上事件模型
 */
export interface ChainEvent {
  /** 事件唯一 ID（blockNumber + logIndex 组合生成） */
  eventId: string;
  
  /** 合约 Event 名称（如 ClaimSubmitted） */
  eventName: string;
  
  /** 发出事件的合约语义名（如 ClaimContract） */
  contractName: string;
  
  /** 发出事件的合约地址 */
  contractAddress: string;
  
  /** 事件所在区块高度 */
  blockNumber: number;
  
  /** 事件所在区块时间戳 */
  blockTimestamp: number;
  
  /** 产生该事件的交易哈希 */
  txHash: string;
  
  /** 解析后的事件参数键值对 */
  args: Record<string, unknown>;
  
  /** 人类可读的事件摘要文本（供 UI 直接展示） */
  displaySummary: string;
  
  /** 事件严重程度（用于高亮展示） */
  severity: EventSeverity;
}

/**
 * 地址摘要信息
 */
export interface AddressSummary {
  /** 钱包地址 */
  address: string;
  
  /** 地址标签（如 "守护者", "普通成员"） */
  label?: string;
  
  /** 交易总数 */
  totalTx: number;
  
  /** 首次交易时间 */
  firstTxTime?: number;
  
  /** 最近交易时间 */
  lastTxTime?: number;
  
  /** 关联的互助申请数量 */
  claimCount?: number;
}

// ============ 搜索结果类型 ============

/**
 * 搜索结果类型
 */
export type SearchResult =
  | { type: 'transaction'; data: TxRecord }
  | { type: 'address'; data: AddressSummary }
  | { type: 'block'; data: BlockSummary }
  | { type: 'not_found' };

/**
 * 区块摘要信息
 */
export interface BlockSummary {
  /** 区块高度 */
  number: number;
  
  /** 区块哈希 */
  hash: string;
  
  /** 父区块哈希 */
  parentHash: string;
  
  /** 区块时间戳 */
  timestamp: number;
  
  /** 交易数量 */
  txCount: number;
  
  /** Gas 使用量 */
  gasUsed: bigint;
  
  /** Gas 限制 */
  gasLimit: bigint;
  
  /** 矿工地址 */
  miner: string;
}

// ============ API 响应类型 ============

/**
 * 个人交易历史 API 响应
 */
export interface TxHistoryResponse {
  /** 交易列表 */
  items: TxRecord[];
  
  /** 下一页游标（用于分页） */
  nextCursor: string | null;
  
  /** 总记录数 */
  total: number;
}

/**
 * 全网事件 API 响应
 */
export interface NetworkEventsResponse {
  /** 事件列表 */
  items: ChainEvent[];
  
  /** 下一页游标 */
  nextCursor: string | null;
}

/**
 * 网络统计信息
 * 
 * 对应文档：5.1 Explorer Service - getNetworkStats()
 */
export interface NetworkStats {
  /** 最新区块高度 */
  latestBlock: number;
  
  /** RPC 节点连接状态 */
  rpcStatus: 'connected' | 'degraded' | 'offline';
  
  /** 当前用户未确认交易数 */
  pendingTxCount?: number;
  
  /** 今日平台事件总量 */
  todayEventCount?: number;
}

// ============ 查询参数类型 ============

/**
 * 交易历史查询参数
 */
export interface TxHistoryOptions {
  /** 每页条数，默认 20，最大 100 */
  pageSize?: number;
  
  /** 分页游标，首次传 null */
  cursor?: string | null;
  
  /** 按交易类型过滤，传空数组表示不过滤 */
  filterType?: TxType[];
}

/**
 * 全网事件查询参数
 */
export interface NetworkEventsOptions {
  /** 要查询的事件名称列表，传空数组查询全部 */
  eventNames?: string[];
  
  /** 起始区块高度，支持简写 latest-500 */
  fromBlock?: number | string;
  
  /** 每页条数，默认 30，最大 200 */
  pageSize?: number;
  
  /** 分页游标 */
  cursor?: string | null;
}

// ============ Zustand Store 类型 ============

/**
 * Explorer Store 状态
 */
export interface ExplorerState {
  /** 当前连接的钱包地址 */
  connectedAddress: string | null;
  
  /** 个人交易历史 */
  personalTxHistory: TxRecord[];
  
  /** 全网事件列表 */
  networkEvents: ChainEvent[];
  
  /** 当前搜索结果 */
  searchResult: SearchResult | null;
  
  /** 是否正在加载 */
  isLoading: boolean;
  
  /** 错误信息 */
  error: string | null;
  
  /** 分页游标（交易历史） */
  txHistoryCursor: string | null;
  
  /** 分页游标（网络事件） */
  networkEventsCursor: string | null;
}

/**
 * Explorer Store 操作
 */
export interface ExplorerActions {
  /** 设置连接的钱包地址 */
  setConnectedAddress: (address: string | null) => void;
  
  /** 加载个人交易历史 */
  loadPersonalTxHistory: (address: string, options?: TxHistoryOptions) => Promise<void>;
  
  /** 加载全网事件 */
  loadNetworkEvents: (options?: NetworkEventsOptions) => Promise<void>;
  
  /** 执行搜索 */
  search: (query: string) => Promise<void>;
  
  /** 清除搜索结果 */
  clearSearch: () => void;
  
  /** 加载更多交易历史 */
  loadMoreTxHistory: () => Promise<void>;
  
  /** 加载更多网络事件 */
  loadMoreNetworkEvents: () => Promise<void>;
  
  /** 设置错误 */
  setError: (error: string | null) => void;
  
  /** 清除所有数据 */
  clearAll: () => void;
}

/**
 * Explorer Store 完整类型
 */
export type ExplorerStore = ExplorerState & ExplorerActions;
