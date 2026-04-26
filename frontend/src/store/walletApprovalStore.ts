import { create } from 'zustand';
import type { WalletApprovalIntent } from '@/lib/wallet/wallet-adapter';

interface WalletApprovalState {
  pending:  WalletApprovalIntent | null;
  _resolve: ((ok: boolean) => void) | null;

  /** Called by the approval handler — shows dialog and waits for user action */
  show:    (intent: WalletApprovalIntent) => Promise<boolean>;
  confirm: () => void;
  cancel:  () => void;
}

export const useWalletApprovalStore = create<WalletApprovalState>((set, get) => ({
  pending:  null,
  _resolve: null,

  show: (intent) =>
    new Promise<boolean>((resolve) => {
      set({ pending: intent, _resolve: resolve });
    }),

  confirm: () => {
    const { _resolve } = get();
    set({ pending: null, _resolve: null });
    _resolve?.(true);
  },

  cancel: () => {
    const { _resolve } = get();
    set({ pending: null, _resolve: null });
    _resolve?.(false);
  },
}));
