'use client';

import React, { useState } from 'react';
import { RoleGuard } from '@/components/auth';
import { useFamilyMemberSBT } from '@/hooks/useFamilyMemberSBT';
import { type RelationshipLabel } from '@/lib/contracts/familyMemberSBT';
import FamilyMemberDrawer from './FamilyMemberDrawer';
import InviteNotificationBanner from './InviteNotificationBanner';
import ToastContainer from '@/components/ui/ToastContainer';
import { useFamilyStore, parseTokenId, type StoredMember } from '@/store/familyStore';
import { toast } from '@/store/toastStore';
import type { Address } from 'viem';
import FamilyMemberList from './FamilyMemberList';
import AddMemberModal from './AddMemberModal';
import FamilyPageHeader from './FamilyPageHeader';
import { shortenAddr } from '@/types/member';
type LocalMember = Omit<StoredMember, 'tokenId'> & { tokenId?: bigint };

/**
 * 家庭成员页面
 * 
 * 功能：
 * - 家庭成员管理
 * - 家庭关系绑定
 * - 家庭福利查看
 */
export default function MemberFamilyPage() {
  const {
    isContractReady,
    createInvite, isCreatingInvite, createInviteError, createInviteReset,
    updateStatus,
  } = useFamilyMemberSBT();

  const { members: stored, addMember, removeMember, updateMember } = useFamilyStore();
  const members: LocalMember[] = stored.map(m => ({ ...m, tokenId: parseTokenId(m) }));

  const [showModal, setShowModal]       = useState(false);
  const [txPending, setTxPending]       = useState(false);
  const [selectedMember, setSelected]   = useState<LocalMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  function openModal() {
    createInviteReset();
    setShowModal(true);
  }

  function closeModal() {
    if (txPending || isCreatingInvite) return;
    setShowModal(false);
  }

  async function handleAdd(form: { address: string; name: string; idNumber: string; relation: RelationshipLabel }) {
    if (isContractReady) {
      try {
        setTxPending(true);
        toast.info('等待钱包确认…', 0);
        const result = await createInvite({
          invitee:      form.address.trim() as Address,
          idNumber:     form.idNumber,
          relationship: form.relation,
        });
        addMember({
          id:         crypto.randomUUID(),
          address:    form.address.trim(),
          name:       form.name.trim(),
          relation:   form.relation,
          txHash:     result.txHash,
          inviteHash: result.inviteHash,
          status:     'invited',
        });
        setShowModal(false);
        toast.success(`邀请已发送！等待 ${shortenAddr(form.address.trim())} 确认上链`);
      } catch {
        toast.error(createInviteError instanceof Error ? createInviteError.message : '发送邀请失败，请重试');
      } finally {
        setTxPending(false);
      }
    } else {
      addMember({
        id:      crypto.randomUUID(),
        address: form.address.trim(),
        name:    form.name.trim(),
        relation: form.relation,
        status:  'local',
      });
      setShowModal(false);
      toast.warning('已添加（未上链）：合约未配置，数据仅保存在本地');
    }
  }

  function handleRemove(id: string) {
    removeMember(id);
  }

  async function handleDeactivate(tokenId: bigint) {
    try {
      setDeactivating(true);
      await updateStatus({ tokenId, isActive: false });
      toast.success('成员已停用（链上记录已更新）');
    } catch {
      toast.error('停用失败，请重试');
    } finally {
      setDeactivating(false);
    }
  }

  const isSubmitting = txPending || isCreatingInvite;

  return (
    <RoleGuard required="member">
      <div className="mx-auto max-w-4xl space-y-6">
        <FamilyPageHeader
          isContractReady={isContractReady}
          memberCount={members.length}
          onAddClick={openModal}
        />

        <InviteNotificationBanner
          onAccepted={(m) => {
            addMember({ ...m, id: crypto.randomUUID(), status: 'on_chain' });
            toast.success('家庭关系已上链，双方签名完成！');
          }}
        />

        <FamilyMemberList
          members={members}
          onMemberClick={setSelected}
          onAddClick={openModal}
          isContractReady={isContractReady}
        />
      </div>

      <ToastContainer />

      <AddMemberModal
        isOpen={showModal}
        onClose={closeModal}
        onAdd={handleAdd}
        isContractReady={isContractReady}
        isSubmitting={isSubmitting}
        error={createInviteError}
      />

      <FamilyMemberDrawer
        member={selectedMember}
        isOpen={!!selectedMember}
        onClose={() => setSelected(null)}
        onRemove={handleRemove}
        onDeactivate={handleDeactivate}
        isDeactivating={deactivating}
      />
    </RoleGuard>
  );
}
