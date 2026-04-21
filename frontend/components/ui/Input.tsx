"use client";

import React, { forwardRef, InputHTMLAttributes, useId, memo } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

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
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // 1. 动态构建 ARIA 属性对象
  // 仅在状态为 true 时添加，否则保持 undefined。React 会在渲染时忽略 undefined 的属性。
  const accessibilityProps = {
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-required": required ? ("true" as const) : undefined,
    "aria-describedby": error ? errorId : (hint ? hintId : undefined),
  };

  // 2. 样式变量定义
  const labelClasses = cn(
    "mb-1.5 block text-sm font-bold tracking-tight",
    error ? "text-red-700" : "text-slate-800",
    disabled && "opacity-50"
  );

  const inputClasses = cn(
    "w-full h-10 rounded-lg border px-3 text-sm transition-all duration-200",
    "placeholder:text-slate-400 focus:outline-none focus:ring-4",
    // 正常态
    "border-slate-200 bg-white text-slate-900 focus:border-blue-600 focus:ring-blue-500/10",
    // 错误态
    error && "border-red-500 bg-red-50/30 text-red-900 focus:border-red-600 focus:ring-red-500/10",
    // 状态态（禁用/只读）
    (disabled || readOnly) && "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed",
    className
  );

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className={labelClasses}>
          {label}
          {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
        </label>
      )}
      
      <input
        ref={ref}
        id={id}
        className={inputClasses}
        disabled={disabled}
        readOnly={readOnly}
        // 核心修复：通过对象展开展开有效属性，避开模板语法检查
        {...accessibilityProps}
        {...props}
      />

      <div className="min-h-[20px] mt-1.5 px-0.5">
        {error ? (
          <p id={errorId} className="text-xs font-semibold text-red-600 flex items-center gap-1" role="alert">
            <span aria-hidden="true">✕</span> {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-slate-500 font-medium">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
});

Input.displayName = "Input";

export default memo(Input);