/**
 * 身份管理 API 服务
 * 
 * 对应后端路由：/v1/identity/*
 * 
 * 功能：
 * - 身份注册
 * - SBT 铸造
 * - 承诺管理
 * 
 * 隐私保护：
 * - registerWitness 仅用于后端内部调用
 * - 前端不应传输 secret/trapdoor
 */

import { get, post } from './client';
import { V1Routes } from './v1Routes';

/**
 * 身份承诺接口
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
 * SBT 信息接口（与后端 GET /v1/identity/sbt/:address 响应一致）
 */
export interface SBTInfo {
  /** 持有者地址（小写） */
  address: string;
  /** SBT 是否已铸造 */
  sbtExists: boolean;
  /** Token ID（uint256 as string），sbtExists=true 时存在 */
  tokenId?: string;
  /** 信用分（0-1000），sbtExists=true 时存在 */
  creditScore?: number;
  /** 等级（1-5），sbtExists=true 时存在 */
  level?: number;
  /** 是否满足理赔资格，sbtExists=true 且链上模式时存在 */
  isClaimEligible?: boolean;
  /** 数据来源：onchain | local */
  source?: 'onchain' | 'local';
}

/**
 * 注册响应
 */
export interface RegisterResponse {
  success: boolean;
  /** Merkle 根 */
  merkleRoot: string;
  /** Merkle 叶子 */
  merkleLeaf: string;
  /** 模式 */
  mode: string;
}

/**
 * 承诺状态响应
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

/**
 * 身份管理 API
 */
export const identityApi = {
  /**
   * 注册身份承诺（已计算好的 commitment）
   * 
   * ⚠️ 需要 Oracle 角色和认证
   * 
   * @param commitment 身份承诺哈希
   * @param level 承诺等级（1-5）
   * @returns 注册结果
   */
  async register(commitment: string, level: number): Promise<RegisterResponse> {
    return post<RegisterResponse>(V1Routes.identity.register, {
      commitment,
      level,
    }, {
      requiresAuth: true,
    });
  },

  /**
   * 从见证人注册身份
   * 
   * ⚠️ 仅后端内部使用，生产环境禁止前端调用
   * ⚠️ 包含敏感数据（secret, trapdoor）
   * 
   * @deprecated 生产环境应使用前端计算 commitment
   * @param socialIdHash 社交 ID 哈希
   * @param secret 私有密钥
   * @param trapdoor 陷阱门
   * @param level 承诺等级
   */
  async registerWitness(
    socialIdHash: string,
    secret: string,
    trapdoor: string,
    level: number
  ): Promise<RegisterResponse> {
    return post<RegisterResponse>(V1Routes.identity.registerWitness, {
      socialIdHash,
      secret,
      trapdoor,
      level,
    }, {
      requiresAuth: true,
    });
  },

  /**
   * 查询承诺状态
   * 
   * @param hash 承诺哈希
   * @returns 承诺状态
   */
  async getCommitmentStatus(hash: string): Promise<CommitmentStatus> {
    return get<CommitmentStatus>(V1Routes.identity.commitment(hash));
  },

  /**
   * 更新承诺等级
   * 
   * ⚠️ 需要 Oracle 角色和认证
   * 
   * @param commitment 承诺哈希
   * @param newLevel 新等级（1-5）
   */
  async updateLevel(commitment: string, newLevel: number): Promise<RegisterResponse> {
    return post<RegisterResponse>(V1Routes.identity.commitmentUpdateLevel, {
      commitment,
      newLevel,
    }, {
      requiresAuth: true,
    });
  },

  /**
   * 封禁承诺
   * 
   * ⚠️ 需要管理员权限
   * 
   * @param commitment 承诺哈希
   * @param reason 封禁原因
   */
  async ban(commitment: string, reason: string): Promise<void> {
    return post<void>(V1Routes.identity.commitmentBan, {
      commitment,
      reason,
    }, {
      requiresAuth: true,
    });
  },

  /**
   * 铸造 SBT
   * 
   * ⚠️ 需要 Oracle 角色和认证
   * 
   * @param commitment 承诺哈希
   * @param recipient 接收者地址
   */
  async mintSBT(commitment: string, recipient: string): Promise<SBTInfo> {
    return post<SBTInfo>(V1Routes.identity.sbtMint, {
      commitment,
      address: recipient,
    }, {
      requiresAuth: true,
    });
  },

  /**
   * 查询 SBT 信息
   * 
   * @param holderAddress 持有者钱包地址（与后端 GET /sbt/:address 一致）
   */
  async getSBTInfo(holderAddress: string): Promise<SBTInfo> {
    return get<SBTInfo>(V1Routes.identity.sbtByAddress(holderAddress));
  },

  /**
   * 更新 SBT 信用分数
   * 
   * ⚠️ 需要 Oracle 角色和认证
   * 
   * @param tokenId 链上 tokenId
   * @param newCredit 新信用分数（后端字段 creditScore）
   */
  async updateSBT(tokenId: string, newCredit: number): Promise<SBTInfo> {
    return post<SBTInfo>(V1Routes.identity.sbtUpdateCredit, {
      tokenId,
      creditScore: newCredit,
    }, {
      requiresAuth: true,
    });
  },
};

/**
 * 导出所有 API
 */
export default identityApi;
