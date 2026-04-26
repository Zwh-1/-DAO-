/**
 * familyStore — 家庭成员本地持久化存储
 *
 * 使用 Zustand persist 中间件自动同步到 localStorage，
 * 刷新页面后数据不丢失。
 *
 * 注意事项：
 *   - tokenId 以 string 形式存储（JSON.stringify 不支持 bigint）
 *   - 链上数据（memberIdHash、isActive 等）不在此存储，
 *     每次从合约实时读取，此处只保存 UI 友好的元数据
 *   - 数据范围：当前浏览器 / 当前设备；跨设备需后端 API
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RelationshipLabel } from '@/lib/contracts/familyMemberSBT';

// ── 存储类型（JSON 安全，tokenId 序列化为 string）──────────────────────────
/** 成员上链状态 */
export type MemberStatus =
  | 'local'        // 未配置合约，仅本地
  | 'invited'      // 第一阶段已完成：邀请已上链，等待对方接受
  | 'on_chain';    // 第二阶段已完成：双方均已签名，SBT 已铸造

export interface StoredMember {
  id:         string;
  address:    string;
  name:       string;
  relation:   RelationshipLabel;
  txHash?:    string;
  /** bigint 序列化为十进制字符串（JSON 安全） */
  tokenId?:   string;
  /** 上链状态 */
  status?:    MemberStatus;
  /** createInvite 返回的链上邀请哈希（bytes32，0x 开头） */
  inviteHash?: string;
}

interface FamilyState {
  members:      StoredMember[];
  addMember:    (member: StoredMember) => void;
  removeMember: (id: string) => void;
  updateMember: (id: string, patch: Partial<StoredMember>) => void;
  clearAll:     () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useFamilyStore = create<FamilyState>()(
  persist(
    (set) => ({
      members: [],

      addMember: (member) =>
        set((s) => ({ members: [...s.members, member] })),

      removeMember: (id) =>
        set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

      updateMember: (id, patch) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),

      clearAll: () => set({ members: [] }),
    }),
    {
      name:    'trustaid-family-members',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ── 转换工具：StoredMember ↔ 带 bigint tokenId 的使用层类型 ─────────────────
/** tokenId string → bigint，供组件使用 */
export function parseTokenId(stored: StoredMember): bigint | undefined {
  if (!stored.tokenId) return undefined;
  try { return BigInt(stored.tokenId); } catch { return undefined; }
}
