'use client';

import React from 'react';
import { useToastStore, type ToastItem } from '@/store/toastStore';

const ICONS: Record<ToastItem['type'], string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const COLORS: Record<ToastItem['type'], string> = {
  success: 'bg-green-50 border-green-300 text-green-800',
  error:   'bg-red-50  border-red-300   text-red-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
  info:    'bg-blue-50 border-blue-300  text-blue-800',
};

const ICON_COLORS: Record<ToastItem['type'], string> = {
  success: 'bg-green-500 text-white',
  error:   'bg-red-500   text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-blue-500  text-white',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto
            animate-fadeInSlide ${COLORS[t.type]}`}
        >
          <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${ICON_COLORS[t.type]}`}>
            {ICONS[t.type]}
          </span>
          <p className="text-sm font-medium flex-1">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 text-current opacity-40 hover:opacity-70 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
