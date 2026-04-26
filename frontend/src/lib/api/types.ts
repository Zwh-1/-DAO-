/**
 * API 类型定义
 * 
 * 包含：
 * - 请求/响应类型
 * - 业务模型类型
 * - 错误类型
 */

// ============ 通用类型 ============

/**
 * 分页参数
 */
export interface PaginationParams {
  /** 每页数量 */
  limit?: number;
  /** 分页游标 */
  cursor?: string;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总数 */
  total: number;
  /** 下一页游标 */
  nextCursor?: string;
}

/**
 * 基础响应
 */
export interface BaseResponse {
  /** 是否成功 */
  success?: boolean;
  /** 错误代码 */
  code?: string;
  /** 错误信息 */
  error?: string;
}

// ============ 身份相关类型 ============

/**
 * 身份承诺
 */
export interface IdentityCommitment {
  /** 承诺哈希 */
  commitment: string;
  /** 承诺等级（1-5） */
  level: number;
  /** 是否已注册 */
  registered: boolean;
  /** 注册时间戳 */
  registeredAt?: number;
}

/**
 * SBT 信息
 */
export interface SBTInfo {
  /** SBT ID */
  id: string;
  /** 所有者地址 */
  owner: string;
  /** 信用分数 */
  credit: number;
  /** 铸造时间 */
  mintedAt: number;
}

/**
 * 注册响应
 */
export interface RegisterResponse extends BaseResponse {
  /** Merkle 根 */
  merkleRoot: string;
  /** Merkle 叶子 */
  merkleLeaf: string;
  /** 模式 */
  mode: string;
}

/**
 * 承诺状态
 */
export interface CommitmentStatus {
  /** 是否已注册 */
  registered: boolean;
  /** 承诺等级 */
  level: number;
  /** 是否被封禁 */
  banned: boolean;
  /** 过期时间 */
  expiry?: number;
}

// ============ zk 证明相关类型 ============

/**
 * zk 证明
 */
export interface ZKProof {
  /** 证明点 pi_a */
  pi_a: string[];
  /** 证明点 pi_b */
  pi_b: string[][];
  /** 证明点 pi_c */
  pi_c: string[];
}

/**
 * 公开信号
 */
export interface PublicSignals {
  /** Nullifier 哈希 */
  nullifierHash: string;
  /** 其他公开信号 */
  [key: string]: string;
}

// ============ 空投申领相关类型 ============

/**
 * 申领提交数据
 */
export interface ClaimSubmitPayload {
  /** 申领 ID */
  claimId: string;
  /** Nullifier 哈希 */
  nullifierHash: string;
  /** zk 证明 */
  proof: ZKProof;
  /** 公开信号 */
  publicSignals: string[];
  /** 证据 CID（IPFS） */
  evidenceCid: string;
  /** 申领金额 */
  amount: string;
}

/**
 * 申领记录
 */
export interface ClaimRecord {
  /** 申领 ID */
  id: string;
  /** Nullifier 哈希（脱敏） */
  nullifierHash: string;
  /** 申领金额 */
  amount: string;
  /** 状态 */
  status: 'pending' | 'approved' | 'rejected';
  /** 提交时间 */
  submittedAt: number;
  /** 揭示时间（如已揭示） */
  revealedAt?: number;
  /** 揭示的地址（如已揭示） */
  revealedAddress?: string;
}

/**
 * 申领列表响应
 */
export interface ClaimListResponse extends PaginatedResponse<ClaimRecord> {}

// ============ 支付通道相关类型 ============

/**
 * 支付通道状态
 */
export type ChannelStatus = 'open' | 'challenged' | 'closed';

/**
 * 支付通道信息
 */
export interface ChannelInfo {
  /** 通道 ID */
  id: string;
  /** 发起方地址 */
  initiator: string;
  /** 对手方地址 */
  counterparty: string;
  /** 余额 */
  balance: string;
  /** 状态 */
  status: ChannelStatus;
  /** 创建时间 */
  createdAt: number;
  /** 关闭时间 */
  closedAt?: number;
}

// ============ 治理相关类型 ============

/**
 * 提案状态
 */
export type ProposalStatus = 'active' | 'succeeded' | 'defeated' | 'executed';

/**
 * 提案信息
 */
export interface Proposal {
  /** 提案 ID */
  id: string;
  /** 提案人地址 */
  proposer: string;
  /** 描述 */
  description: string;
  /** 支持票数 */
  forVotes: bigint;
  /** 反对票数 */
  againstVotes: bigint;
  /** 状态 */
  status: ProposalStatus;
  /** 创建时间 */
  createdAt: number;
  /** 结束时间 */
  endsAt: number;
  /** 执行时间 */
  executedAt?: number;
}

/**
 * 投票记录
 */
export interface Vote {
  /** 提案 ID */
  proposalId: string;
  /** 投票人地址 */
  voter: string;
  /** 支持（true）或反对（false） */
  support: boolean;
  /** 票数 */
  votes: bigint;
  /** 投票时间 */
  votedAt: number;
}

// ============ 错误类型 ============

/**
 * API 错误
 */
export interface ApiErrorData {
  /** HTTP 状态码 */
  status: number;
  /** 错误代码 */
  code?: string;
  /** 错误信息 */
  message: string;
  /** 详细数据 */
  data?: unknown;
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 字段名 */
  field: string;
  /** 错误信息 */
  message: string;
}
