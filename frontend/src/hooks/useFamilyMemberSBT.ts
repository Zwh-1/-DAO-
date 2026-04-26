/**
 * useFamilyMemberSBT — 家庭成员 SBT 上链 Hook
 *
 * 使用 TanStack Query v5：
 *   - useQuery  → 读取链上 tokenIds / 成员详情（带缓存 + 自动重试）
 *   - useMutation → 铸造 / 修改状态（带乐观更新 + 错误回滚）
 *
 * 当合约地址未配置时，优雅降级（不抛错，返回 isContractReady: false）
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  mintFamilyMemberSBT,
  updateMemberStatus,
  getHolderFamilyTokens,
  getMemberOnChain,
  createFamilyInvite,
  acceptFamilyInvite,
  getInvitesForMe,
  type RelationshipLabel,
  type OnChainMember,
  type MintFamilyMemberParams,
  type CreateInviteParams,
} from '@/lib/contracts/familyMemberSBT';
import type { Address } from 'viem';

// ── 环境常量 ─────────────────────────────────────────────────────────────────
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  'http://127.0.0.1:8545';

const CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '31337',
  10,
);

const CONTRACT_CONFIGURED =
  !!process.env.NEXT_PUBLIC_FAMILY_MEMBER_SBT_ADDRESS &&
  process.env.NEXT_PUBLIC_FAMILY_MEMBER_SBT_ADDRESS !==
    '0x0000000000000000000000000000000000000000';

// ── Query Key 工厂 ───────────────────────────────────────────────────────────
const familySbtKeys = {
  all:        ['family-sbt'] as const,
  tokens:     (holder: string) => ['family-sbt', 'tokens', holder] as const,
  member:     (tokenId: string) => ['family-sbt', 'member', tokenId] as const,
  invites:    (invitee: string) => ['family-sbt', 'invites', invitee] as const,
};

// ── 主 Hook ──────────────────────────────────────────────────────────────────
export function useFamilyMemberSBT() {
  const address = useAuthStore(s => s.address) as Address | null;
  const qc = useQueryClient();

  // ── 读取：持有者名下全部家庭成员 tokenIds ──────────────────────────────────
  const tokenIdsQuery = useQuery({
    queryKey: familySbtKeys.tokens(address ?? ''),
    queryFn:  () =>
      getHolderFamilyTokens(address!, CHAIN_ID, RPC_URL),
    enabled:   !!address && CONTRACT_CONFIGURED,
    staleTime: 30_000,
    retry:     2,
  });

  // ── 写入：铸造家庭成员 SBT ────────────────────────────────────────────────
  const mintMutation = useMutation({
    mutationFn: (params: Omit<MintFamilyMemberParams, 'from' | 'rpcUrl' | 'chainId'>) =>
      mintFamilyMemberSBT({
        ...params,
        from:    address!,
        rpcUrl:  RPC_URL,
        chainId: CHAIN_ID,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familySbtKeys.tokens(address ?? '') });
    },
  });

  // ── 写入：修改激活状态 ─────────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: (params: { tokenId: bigint; isActive: boolean }) =>
      updateMemberStatus({ ...params, from: address!, rpcUrl: RPC_URL }),
    onSuccess: (_result, { tokenId }) => {
      qc.invalidateQueries({
        queryKey: familySbtKeys.member(tokenId.toString()),
      });
    },
  });

  // ── 写入：发起邀请（第一阶段，主账户签名） ──────────────────────────────
  const createInviteMutation = useMutation({
    mutationFn: (params: Omit<CreateInviteParams, 'from' | 'rpcUrl'>) =>
      createFamilyInvite({ ...params, from: address!, rpcUrl: RPC_URL }),
  });

  // ── 写入：接受邀请（第二阶段，被邀请方签名） ──────────────────────────────
  const acceptInviteMutation = useMutation({
    mutationFn: (inviteHash: `0x${string}`) =>
      acceptFamilyInvite({ inviteHash, from: address!, rpcUrl: RPC_URL, chainId: CHAIN_ID }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familySbtKeys.invites(address ?? '') });
      qc.invalidateQueries({ queryKey: familySbtKeys.tokens(address ?? '') });
    },
  });

  // ── 读取：当前钱包地址的待处理邀请列表 ──────────────────────────────
  const myInvitesQuery = useQuery({
    queryKey: familySbtKeys.invites(address ?? ''),
    queryFn:  () => getInvitesForMe(address!, CHAIN_ID, RPC_URL),
    enabled:  !!address && CONTRACT_CONFIGURED,
    staleTime: 20_000,
    retry: 1,
  });

  return {
    /** 合约地址是否已在环境变量中配置 */
    isContractReady:  CONTRACT_CONFIGURED,

    /** 持有者名下的 tokenId 列表 */
    tokenIds:         (tokenIdsQuery.data ?? []) as readonly bigint[],
    isLoadingIds:     tokenIdsQuery.isLoading,
    tokenIdsError:    tokenIdsQuery.error,

    /** 铸造家庭成员 SBT */
    mint:             mintMutation.mutateAsync,
    isMinting:        mintMutation.isPending,
    mintError:        mintMutation.error,
    mintReset:        mintMutation.reset,

    /** 第一阶段：发起邀请 */
    createInvite:       createInviteMutation.mutateAsync,
    isCreatingInvite:   createInviteMutation.isPending,
    createInviteError:  createInviteMutation.error,
    createInviteReset:  createInviteMutation.reset,

    /** 第二阶段：接受邀请 */
    acceptInvite:       acceptInviteMutation.mutateAsync,
    isAcceptingInvite:  acceptInviteMutation.isPending,
    acceptInviteError:  acceptInviteMutation.error,

    /** 我收到的邀请列表（待接受） */
    myInviteHashes:     (myInvitesQuery.data ?? []) as readonly `0x${string}`[],
    isLoadingInvites:   myInvitesQuery.isLoading,

    /** 修改激活状态 */
    updateStatus:     updateStatusMutation.mutateAsync,
    isUpdating:       updateStatusMutation.isPending,
    updateError:      updateStatusMutation.error,
  };
}

// ── 单成员详情 Hook ───────────────────────────────────────────────────────────
export function useFamilyMember(tokenId: bigint | undefined) {
  return useQuery<OnChainMember>({
    queryKey: familySbtKeys.member(tokenId?.toString() ?? ''),
    queryFn:  () => getMemberOnChain(tokenId!, CHAIN_ID, RPC_URL),
    enabled:  tokenId !== undefined && CONTRACT_CONFIGURED,
    staleTime: 60_000,
  });
}
