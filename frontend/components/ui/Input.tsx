"use client";

import React, { forwardRef, InputHTMLAttributes, useId } from "react";
import clsx from "clsx"; // 需要安装: npm install clsx

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 输入框上方的标签文本 */
  label?: string;
  /** 错误提示信息，存在时会覆盖 hint 并触发错误样式 */
  error?: string;
  /** 辅助说明文本，仅在无错误时显示 */
  hint?: string;
  /** 是否必填（仅影响标签上的星号显示，不控制原生 required 行为） */
  required?: boolean;
}

/**
 * 通用表单输入组件
 *
 * 特性：
 * - 支持标签、错误提示、辅助说明
 * - 完整的 ARIA 支持（使用 useId 生成唯一 ID 并通过 aria-describedby 关联）
 * - 错误状态视觉反馈（红色边框、浅红背景、红色标签）
 * - 禁用/只读状态样式
 * - 完全透传原生 input 属性，支持 ref 转发
 * - 通过 CSS 变量支持主题定制（主色、警示色、辅助色）
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    required = false,
    className = "",
    disabled,
    readOnly,
    ...props
  },
  ref
) {
  // 生成唯一 ID，用于关联输入框和辅助信息（符合 WCAG 规范）
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;

  // 构建 aria-describedby 属性（同时关联错误和提示，屏幕阅读器会按顺序读取）
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  // 动态样式管理（使用 clsx 提高可读性并避免 undefined 拼接问题）
  const labelClasses = clsx(
    "mb-1 block text-sm font-medium",
    error ? "text-alert" : "text-primary"
  );

  const inputClasses = clsx(
    // 基础样式
    "w-full rounded-md border px-3 py-2 text-sm transition-colors",
    // 错误状态样式
    error && [
      "border-red-300 bg-red-50 text-alert",
      "focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400",
    ],
    // 正常状态样式
    !error && [
      "border-gray-100/60 bg-white text-primary",
      "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
    ],
    // 禁用状态
    disabled && "cursor-not-allowed bg-surface text-steel/40",
    // 只读状态（视觉上与正常相似但光标改为默认）
    readOnly && "cursor-default bg-surface",
    // 用户自定义类名（放在最后以允许覆盖）
    className
  );

  return (
    <div className="block">
      {label && (
        <label htmlFor={id} className={labelClasses}>
          {label}
          {required && <span className="ml-0.5 text-alert">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={inputClasses}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={!!error}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {/* 辅助信息：优先显示错误，无错误时显示 hint */}
      {hint && !error && (
        <div id={hintId} className="mt-1 block text-xs text-steel">
          {hint}
        </div>
      )}
      {error && (
        <div id={errorId} className="mt-1 block text-xs text-alert" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

// 设置 displayName 便于调试
Input.displayName = "Input";

// 使用 memo 避免父组件重渲染导致的无用更新（注意：若传入内联函数作为 props 仍会失效）
export default React.memo(Input);