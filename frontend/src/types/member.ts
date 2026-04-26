import {
    RELATIONSHIP,
    type RelationshipLabel,
} from "@/lib/contracts/familyMemberSBT"
import { type RelationshipLabel } from "@/lib/contracts/familyMemberSBT"

const ACTION_ICON: Record<string, string> = {
  claim_submitted: "📋", claim_paid: "💰", claim_rejected: "❌",
  arbitration_assigned: "⚖️", challenge_received: "⚠️",
  role_granted: "🎖️", role_revoked: "🔴", reward: "🏆",
};

const RELATION_EMOJI: Record<RelationshipLabel, string> = {
    配偶: "💑",
    子女: "👶",
    父母: "👴",
    兄弟姐妹: "🤝",
    其他: "👤",
}

const EMPTY_FORM = {
    address: "",
    name: "",
    idNumber: "",
    relation: "配偶" as RelationshipLabel,
}

type FormErrors = Partial<Record<keyof typeof EMPTY_FORM, string>>

const EXPLORER_BASE = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || ""

interface AddMemberModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (form: typeof EMPTY_FORM) => Promise<void>
    isContractReady: boolean
    isSubmitting: boolean
    error: Error | string | null
}

interface Props {
    onAccepted: (m: {
        address: string
        name: string
        relation: RelationshipLabel
        tokenId?: string
        txHash?: string
    }) => void
}

interface DrawerMember {
    id: string
    address: string
    name: string
    relation: RelationshipLabel
    txHash?: string
    tokenId?: bigint
}

interface FamilyMemberDrawerProps {
    member: DrawerMember | null
    isOpen: boolean
    onClose: () => void
    onRemove: (id: string) => void
    onDeactivate: (tokenId: bigint) => Promise<void>
    isDeactivating?: boolean
}

/** 关系枚举数字 → 中文标签 */
export function labelFromRelNum(num: number): RelationshipLabel {
    const entry = (
        Object.entries(RELATIONSHIP) as [RelationshipLabel, number][]
    ).find(([, v]) => v === num)
    return entry?.[0] ?? "其他"
}

/** 哈希预览：0x + 前 8 位十六进制 */
export function shortHash(hash: string): string {
    return `${hash.slice(0, 10)}…`
}

/** 地址缩写：0x + 前 6 位 + 后 4 位 */
export function shortenAddr(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function labelFromRelNum(num: number): RelationshipLabel {
    const entry = (
        Object.entries(RELATIONSHIP) as [RelationshipLabel, number][]
    ).find(([, v]) => v === num)
    return entry?.[0] ?? "其他"
}

export { type FormErrors }
export {
    RELATION_EMOJI,
    EMPTY_FORM,
    AddMemberModalProps,
    FamilyMemberDrawerProps,
    EXPLORER_BASE,
    DrawerMember,
    Props,
    ACTION_ICON
}
