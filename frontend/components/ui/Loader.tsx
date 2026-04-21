/**
 * 加载状态指示器组件
 * 
 * 职责：
 * - 统一 Loading 动画样式
 * - 支持多种尺寸与颜色
 * - 用于按钮、页面、数据加载等场景
 * 
 * 视觉规范：
 * - 医疗蓝为主色调
 * - 简洁流畅的动画
 * - 无蓝紫渐变
 */

"use client";

import { type HTMLAttributes } from "react";

/**
 * Loading Spinner 属性接口
 */
interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /** 尺寸：sm (16px), md (24px), lg (32px) */
  size?: "sm" | "md" | "lg";
  /** 颜色：primary, success, error, white */
  color?: "primary" | "success" | "error" | "white";
  /** 是否居中显示 */
  centered?: boolean;
}

/**
 * 颜色映射（医疗专业配色）
 */
const COLOR_MAP: Record<string, string> = {
  primary: "border-blue-600",
  success: "border-green-600",
  error: "border-red-600",
  white: "border-white",
};

const COLOR_BORDER_TOP: Record<string, string> = {
  primary: "border-t-blue-600",
  success: "border-t-green-600",
  error: "border-t-red-600",
  white: "border-t-white",
};

/**
 * 尺寸映射
 */
const SIZE_MAP: Record<string, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-3",
  lg: "w-8 h-8 border-4",
};

/**
 * Loading Spinner 组件
 * 
 * 使用方式：
 * ```tsx
 * <Spinner size="md" color="primary" />
 * ```
 */
export function Spinner({
  size = "md",
  color = "primary",
  centered = false,
  className = "",
  ...props
}: SpinnerProps) {
  const containerClasses = centered ? "flex items-center justify-center" : "";
  
  return (
    <div
      className={`${containerClasses} ${className}`}
      {...props}
    >
      <div
        className={`
          ${SIZE_MAP[size]}
          rounded-full
          border ${COLOR_MAP[color]}
          ${COLOR_BORDER_TOP[color]}
          border-t-transparent
          animate-spin
        `}
        style={{
          borderTopColor: "transparent",
        }}
      />
    </div>
  );
}

/**
 * 按钮加载状态组件
 * 
 * 使用方式：
 * ```tsx
 * <Button loading={isLoading}>
 *   提交
 * </Button>
 * ```
 */
export function ButtonLoader({
  size = "sm",
  color = "white",
}: {
  size?: "sm" | "md";
  color?: "white" | "primary";
}) {
  return (
    <Spinner
      size={size}
      color={color}
      className="inline-flex"
    />
  );
}

/**
 * 页面级加载组件
 * 
 * 使用方式：
 * ```tsx
 * <PageLoader text="加载中..." />
 * ```
 */
export function PageLoader({
  text = "加载中...",
}: {
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner size="lg" color="primary" className="mb-4" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

/**
 * 表格加载组件（骨架屏）
 * 
 * 使用方式：
 * ```tsx
 * <TableLoader rows={5} />
 * ```
 */
export function TableLoader({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-gray-100 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * 卡片加载组件（骨架屏）
 * 
 * 使用方式：
 * ```tsx
 * <CardLoader count={3} />
 * ```
 */
export function CardLoader({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <div className="h-4 bg-gray-100 rounded w-3/4 mb-3 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-full mb-2 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * 导出默认组件
 */
export default Spinner;
