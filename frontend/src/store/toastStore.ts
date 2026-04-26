import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id:       string;
  type:     ToastType;
  message:  string;
}

interface ToastState {
  toasts:      ToastItem[];
  addToast:    (type: ToastType, message: string, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (type, message, durationMs = 4500) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    if (durationMs > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), durationMs);
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string, ms?: number) => useToastStore.getState().addToast('success', msg, ms),
  error:   (msg: string, ms?: number) => useToastStore.getState().addToast('error',   msg, ms),
  info:    (msg: string, ms?: number) => useToastStore.getState().addToast('info',    msg, ms),
  warning: (msg: string, ms?: number) => useToastStore.getState().addToast('warning', msg, ms),
};
