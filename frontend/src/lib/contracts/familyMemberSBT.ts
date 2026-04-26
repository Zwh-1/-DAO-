/**
 * FamilyMemberSBT 合约交互层
 *
 * 安全规范（最高优先级）：
 *   - 证件号/明文身份 ID 永不离开 hashMemberId()，不传网络、不打日志
 *   - 链上只存 keccak256 哈希（bytes32），符合 GDPR/PIPL 数据最小化
 *   - 使用 viem encodeFunctionData + walletSendTransaction，私钥不暴露
 *
 * Gas 优化说明：
 *   - 不手动设置 gas limit，让节点 eth_estimateGas 自动计算
 *   - 读取操作使用 createPublicClient + http RPC，不消耗 gas
 *   - ABI 仅包含实际调用的函数，减少打包体积
 */

import {
  encodeFunctionData,
  encodePacked,
  keccak256,
  toBytes,
  createPublicClient,
  http,
  type Address,
} from 'viem';
import { hardhat } from 'viem/chains';
import {
  walletSendTransaction,
  waitForTxReceipt,
} from '@/lib/wallet/wallet-adapter';
import { getContractAddress } from './addresses';

// ── 关系类型枚举（与合约常量严格对齐）──────────────────────────────────────
export const RELATIONSHIP = {
  配偶:    1,
  子女:    2,
  父母:    3,
  兄弟姐妹: 4,
  其他:    5,
} as const satisfies Record<string, number>;

export type RelationshipLabel = keyof typeof RELATIONSHIP;

export const RELATIONSHIP_LABELS = Object.keys(RELATIONSHIP) as RelationshipLabel[];

// ── 最小 ABI（仅包含需要调用的函数，减少打包体积）──────────────────────────
export const FAMILY_MEMBER_SBT_ABI = [
  {
    name: 'mintMember',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',           type: 'address' },
      { name: 'memberIdHash', type: 'bytes32' },
      { name: 'relationship', type: 'uint8'   },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'getMember',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'memberIdHash',  type: 'bytes32' },
          { name: 'primaryHolder', type: 'address' },
          { name: 'joinTimestamp', type: 'uint64'  },
          { name: 'relationship',  type: 'uint8'   },
          { name: 'isActive',      type: 'bool'    },
        ],
      },
    ],
  },
  {
    name: 'updateStatus',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId',  type: 'uint256' },
      { name: 'isActive', type: 'bool'    },
    ],
    outputs: [],
  },
  {
    name: 'tokensOfHolder',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    name: 'isHashMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'memberIdHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'createInvite',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invitee',      type: 'address' },
      { name: 'memberIdHash', type: 'bytes32' },
      { name: 'relationship', type: 'uint8'   },
    ],
    outputs: [{ name: 'inviteHash', type: 'bytes32' }],
  },
  {
    name: 'acceptInvite',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'inviteHash', type: 'bytes32' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'cancelInvite',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'inviteHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getPendingInvite',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'inviteHash', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'primaryHolder', type: 'address' },
        { name: 'invitee',       type: 'address' },
        { name: 'memberIdHash',  type: 'bytes32' },
        { name: 'relationship',  type: 'uint8'   },
        { name: 'active',        type: 'bool'    },
      ],
    }],
  },
  {
    name: 'getInvitesForInvitee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invitee', type: 'address' }],
    outputs: [{ type: 'bytes32[]' }],
  },
] as const;

// ── 隐私核心：客户端 keccak256 哈希 ─────────────────────────────────────────
/**
 * 对证件号进行 keccak256 哈希处理
 *
 * ⚠️ 安全约定：
 *   - idNumber 参数作用域仅限此函数，调用方不得将明文传入其他任何函数
 *   - 返回值（哈希）可安全上链
 *   - 不打日志，不传入 fetch body
 *
 * @param idNumber 原始证件号（身份证/护照/其他）
 * @returns        keccak256 哈希，格式 `0x${string}`（bytes32）
 */
export function hashMemberId(idNumber: string): `0x${string}` {
  return keccak256(toBytes(idNumber.trim()));
}

// ── 内部：获取合约地址 ───────────────────────────────────────────────────────
function getAddress(): Address {
  return getContractAddress('FamilyMemberSBT') as Address;
}

// ── 内部：创建只读 viem 客户端 ───────────────────────────────────────────────
function makePublicClient(chainId: number, rpcUrl: string) {
  return createPublicClient({
    chain: { ...hardhat, id: chainId },
    transport: http(rpcUrl),
  });
}

// ── 写入：铸造家庭成员 SBT ────────────────────────────────────────────────────
export interface MintFamilyMemberParams {
  /** 成员钱包地址（SBT 归属方） */
  to: Address;
  /**
   * 原始证件号（明文）
   * 仅在此函数内部调用 hashMemberId() 转为哈希，不出此层
   */
  idNumber: string;
  /** 关系标签 */
  relationship: RelationshipLabel;
  /** 发起人地址（主账户，必须持有主 SBT） */
  from: Address;
  /** RPC URL（用于等待回执） */
  rpcUrl: string;
  /** 链 ID（用于铸造后查询 tokenId） */
  chainId: number;
}

export interface MintResult {
  txHash: string;
  /** 铸造后从链上查询到的 tokenId（用于详情页关联） */
  tokenId?: bigint;
}

/**
 * 为家庭成员铸造 SBT 并等待链上确认（1 个区块）
 *
 * Gas 优化：不手动设置 gasLimit，由节点 eth_estimateGas 自动估算
 */
export async function mintFamilyMemberSBT(params: MintFamilyMemberParams): Promise<MintResult> {
  const { to, idNumber, relationship, from, rpcUrl, chainId } = params;

  // ✅ 隐私核心：明文 ID 在此处转为哈希，不再向外传递
  const memberIdHash = hashMemberId(idNumber);

  const data = encodeFunctionData({
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'mintMember',
    args: [to, memberIdHash, RELATIONSHIP[relationship]],
  });

  const txHash = await walletSendTransaction({
    from,
    to: getAddress(),
    data,
    valueWei: '0',
  });

  await waitForTxReceipt(txHash, { rpcUrl });

  // 铸造确认后，查询主账户的 tokenId 列表，最后一个即为本次新铸造的
  try {
    const tokens = await getHolderFamilyTokens(from, chainId, rpcUrl);
    const tokenId = tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
    return { txHash, tokenId };
  } catch {
    return { txHash };
  }
}

// ── 写入：修改激活状态 ────────────────────────────────────────────────────────
export async function updateMemberStatus(params: {
  tokenId: bigint;
  isActive: boolean;
  from: Address;
  rpcUrl: string;
}): Promise<string> {
  const { tokenId, isActive, from, rpcUrl } = params;

  const data = encodeFunctionData({
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'updateStatus',
    args: [tokenId, isActive],
  });

  const txHash = await walletSendTransaction({ from, to: getAddress(), data, valueWei: '0' });
  await waitForTxReceipt(txHash, { rpcUrl });
  return txHash;
}

// ── 读取：链上成员数据类型 ───────────────────────────────────────────────────
export interface OnChainMember {
  memberIdHash:  `0x${string}`;
  primaryHolder: Address;
  joinTimestamp: bigint;
  relationship:  number;
  isActive:      boolean;
}

export interface OnChainInvite {
  primaryHolder: Address;
  invitee:       Address;
  memberIdHash:  `0x${string}`;
  relationship:  number;
  active:        boolean;
}

// ── 读取：持有者名下全部 tokenId ─────────────────────────────────────────────
export async function getHolderFamilyTokens(
  holder: Address,
  chainId: number,
  rpcUrl: string,
): Promise<readonly bigint[]> {
  const client = makePublicClient(chainId, rpcUrl);
  return client.readContract({
    address: getAddress(),
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'tokensOfHolder',
    args: [holder],
  }) as Promise<readonly bigint[]>;
}

// ── 读取：单个成员详情 ───────────────────────────────────────────────────────
export async function getMemberOnChain(
  tokenId: bigint,
  chainId: number,
  rpcUrl: string,
): Promise<OnChainMember> {
  const client = makePublicClient(chainId, rpcUrl);
  const result = await client.readContract({
    address: getAddress(),
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'getMember',
    args: [tokenId],
  });
  return result as unknown as OnChainMember;
}

// ── 读取：校验哈希是否已铸造（前端去重预检）────────────────────────────────
export async function checkHashMinted(
  idNumber: string,
  chainId: number,
  rpcUrl: string,
): Promise<boolean> {
  const memberIdHash = hashMemberId(idNumber);
  const client = makePublicClient(chainId, rpcUrl);
  return client.readContract({
    address: getAddress(),
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'isHashMinted',
    args: [memberIdHash],
  }) as Promise<boolean>;
}

// ── 写入：发起邀请（第一阶段，主账户签名）──────────────────────────────────
export interface CreateInviteParams {
  invitee:      Address;
  idNumber:     string;
  relationship: RelationshipLabel;
  from:         Address;
  rpcUrl:       string;
}

export async function createFamilyInvite(params: CreateInviteParams): Promise<{ txHash: string; inviteHash: `0x${string}` }> {
  const { invitee, idNumber, relationship, from, rpcUrl } = params;
  const memberIdHash = hashMemberId(idNumber);

  const data = encodeFunctionData({
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'createInvite',
    args: [invitee, memberIdHash, RELATIONSHIP[relationship]],
  });

  const txHash = await walletSendTransaction({ from, to: getAddress(), data, valueWei: '0' });
  await waitForTxReceipt(txHash, { rpcUrl });

  // 与合约一致： keccak256(abi.encodePacked(primaryHolder, invitee, memberIdHash, relationship))
  const inviteHash = keccak256(
    encodePacked(
      ['address', 'address', 'bytes32', 'uint8'],
      [from, invitee, memberIdHash, RELATIONSHIP[relationship]],
    ),
  );

  return { txHash, inviteHash };
}

// ── 写入：接受邀请（第二阶段，被邀请方签名）──────────────────────────────────
export async function acceptFamilyInvite(params: {
  inviteHash: `0x${string}`;
  from:       Address;
  rpcUrl:     string;
  chainId:    number;
}): Promise<{ txHash: string; tokenId?: bigint }> {
  const { inviteHash, from, rpcUrl, chainId } = params;

  const data = encodeFunctionData({
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'acceptInvite',
    args: [inviteHash],
  });

  const txHash = await walletSendTransaction({ from, to: getAddress(), data, valueWei: '0' });
  await waitForTxReceipt(txHash, { rpcUrl });

  try {
    const tokens = await getHolderFamilyTokens(from, chainId, rpcUrl);
    const tokenId = tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
    return { txHash, tokenId };
  } catch {
    return { txHash };
  }
}

// ── 读取：被邀请方的待处理邀请列表 ──────────────────────────────────────────
export async function getInvitesForMe(
  invitee: Address,
  chainId: number,
  rpcUrl: string,
): Promise<readonly `0x${string}`[]> {
  const client = makePublicClient(chainId, rpcUrl);
  return client.readContract({
    address: getAddress(),
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'getInvitesForInvitee',
    args: [invitee],
  }) as Promise<readonly `0x${string}`[]>;
}

// ── 读取：单个邀请详情 ───────────────────────────────────────────────────────
export async function getInviteDetail(
  inviteHash: `0x${string}`,
  chainId: number,
  rpcUrl: string,
): Promise<OnChainInvite> {
  const client = makePublicClient(chainId, rpcUrl);
  const result = await client.readContract({
    address: getAddress(),
    abi: FAMILY_MEMBER_SBT_ABI,
    functionName: 'getPendingInvite',
    args: [inviteHash],
  });
  return result as unknown as OnChainInvite;
}
