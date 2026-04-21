/**
 * 全局 Toast/Snackbar 组件系统
 * * 职责：
 * - 统一全局提示样式（成功、警告、错误、信息）
 * - 替代局部红色横幅错误提示
 * - 支持自动消失、手动关闭、优先级排序
 */

"use client";

import { Toaster, toast } from "sonner";
import { useCallback } from "react";

/**
 * Toast 类型枚举
 */
export type ToastType = "success" | "error" | "warning" | "info" | "loading";

/**
 * Toast 配置接口
 */
interface ToastOptions {
  /** 标题（可选） */
  title?: string;
  /** 详细描述（可选） */
  description?: string;
  /** 持续时间（毫秒），0 表示不自动消失 */
  duration?: number;
  /** 是否可关闭 */
  closable?: boolean;
  /** 指定 ID，用于更新已存在的 Toast */
  id?: string | number;
  /** 操作按钮（可选） */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Partial<ToastOptions> = {
  duration: 3000,
  closable: true,
};

/**
 * 错误消息脱敏处理
 */
function sanitizeErrorMessage(message: string): string {
  // 移除 JWT Token
  const tokenRegex = /[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g;
  let sanitized = message.replace(tokenRegex, "[TOKEN_REDACTED]");
  
  // 移除钱包地址
  const addressRegex = /0x[a-fA-F0-9]{40}/g;
  sanitized = sanitized.replace(addressRegex, "[ADDRESS_REDACTED]");
  
  return sanitized;
}

/**
 * Toast 管理器类
 */
class ToastManager {
  success(message: string, options?: ToastOptions): string | number {
    return toast.success(message, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }
  
  error(message: string, options?: ToastOptions): string | number {
    const sanitizedMessage = sanitizeErrorMessage(message);
    return toast.error(sanitizedMessage, {
      ...DEFAULT_OPTIONS,
      duration: options?.duration ?? 5000,
      ...options,
    });
  }
  
  warning(message: string, options?: ToastOptions): string | number {
    return toast.warning(message, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }
  
  info(message: string, options?: ToastOptions): string | number {
    return toast.info(message, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }
  
  loading(message: string, options?: ToastOptions): string | number {
    return toast.loading(message, {
      ...DEFAULT_OPTIONS,
      duration: 0,
      ...options,
    });
  }
  
  dismiss(id?: string | number): void {
    toast.dismiss(id);
  }

  dismissAll(): void {
    toast.dismiss();
  }
}

export const toastManager = new ToastManager();

/**
 * React Hook：使用 Toast
 */
export function useToast() {
  return {
    success: useCallback((msg: string, opt?: ToastOptions) => toastManager.success(msg, opt), []),
    error: useCallback((msg: string, opt?: ToastOptions) => toastManager.error(msg, opt), []),
    warning: useCallback((msg: string, opt?: ToastOptions) => toastManager.warning(msg, opt), []),
    info: useCallback((msg: string, opt?: ToastOptions) => toastManager.info(msg, opt), []),
    loading: useCallback((msg: string, opt?: ToastOptions) => toastManager.loading(msg, opt), []),
    dismiss: useCallback((id?: string | number) => toastManager.dismiss(id), []),
    dismissAll: useCallback(() => toastManager.dismissAll(), []),
  };
}

/**
 * Toast 提供者组件
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: "system-ui, -apple-system, sans-serif",
            borderRadius: "10px",
          },
          classNames: {
            toast: "toast-base",
            success: "toast-success",
            error: "toast-error",
            warning: "toast-warning",
            info: "toast-info",
            loading: "toast-loading",
          },
        }}
      />
      
      <style jsx global>{`
        /* 统一基础样式，确保文字居中对齐 */
        .toast-base {
          padding: 12px 16px !important;
          font-weight: 500 !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }

        .toast-success {
          background: #10B981 !important;
          color: #FFFFFF !important;
          border-color: #059669 !important;
        }
        
        .toast-error {
          background: #EF4444 !important;
          color: #FFFFFF !important;
          border-color: #DC2626 !important;
        }
        
        .toast-warning {
          background: #F59E0B !important;
          color: #FFFFFF !important;
          border-color: #D97706 !important;
        }
        
        .toast-info {
          background: #0066CC !important;
          color: #FFFFFF !important;
          border-color: #0052A3 !important;
        }
        
        .toast-loading {
          background: #F3F4F6 !important;
          color: #374151 !important;
          border-color: #E5E7EB !important;
        }

        /* 修复 Sonner 默认关闭按钮颜色 */
        .toast-base [data-close-button="true"] {
          background: rgba(0, 0, 0, 0.1);
          color: currentColor;
          border: none;
        }
      `}</style>
    </>
  );
}

export default ToastProvider;