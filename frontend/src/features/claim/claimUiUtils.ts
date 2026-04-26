/**
 * 申领页展示用工具（不涉及 ZK 密码学）
 */

import { formatWeiToEth } from '../../lib/zk/claimAmount';

export type ClaimWindowPhase = 'unknown' | 'upcoming' | 'active' | 'ended';

export function getClaimWindowPhase(tsStart: string, tsEnd: string): ClaimWindowPhase {
  if (!tsStart || !tsEnd) return 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const a = Number(tsStart);
  const b = Number(tsEnd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'unknown';
  if (now < a) return 'upcoming';
  if (now > b) return 'ended';
  return 'active';
}

export function formatWeiEthLabel(wei: string | null | undefined): string {
  if (wei == null || wei === '') return '—';
  try {
    return `${formatWeiToEth(wei)} ETH`;
  } catch {
    return '—';
  }
}

export function windowPhaseLabel(phase: ClaimWindowPhase): string {
  switch (phase) {
    case 'upcoming':
      return '未开始';
    case 'active':
      return '进行中';
    case 'ended':
      return '已结束';
    default:
      return '未知';
  }
}
