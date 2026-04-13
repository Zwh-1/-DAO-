"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  memo,
} from "react";
import clsx from "clsx"; // 需要安装：npm install clsx

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮视觉变体 */
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
  /** 按钮尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否显示加载状态（会禁用按钮并显示旋转图标） */
  isLoading?: boolean;
  /** 加载时是否隐藏按钮文字（仅保留图标，适用于窄按钮） */
  hideTextOnLoading?: boolean;
  /** 自定义加载图标（默认使用 SVG 环形） */
  loadingIcon?: ReactNode;
  /** 是否将按钮渲染为其他元素（如 <a>），需要配合 asChild 使用（本版暂不实现，留作扩展） */
  // asChild?: boolean;
}

/**
 * 通用按钮组件
 *
 * @description
 * 封装原生按钮，提供多种视觉变体、尺寸、加载状态，并内置可访问性支持。
 *
 * ## 设计原则
 * - **医疗级配色**：主色（primary）、成功（success）、危险（danger）、次要（secondary）、幽灵（ghost）
 * - **安全交互**：禁用状态禁止点击，加载状态自动禁用并反馈
 * - **可访问性**：支持键盘焦点、屏幕阅读器（加载状态会通知）、ARIA 属性
 */
export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      hideTextOnLoading = false,
      loadingIcon,
      children,
      className = "",
      disabled,
      type = "button", // 默认类型为 button，避免在表单内意外提交
      ...props
    },
    ref
  ) {
    // ----- 样式定义（Tailwind CSS 类名）-----
    // 基础样式：布局、圆角、过渡、焦点环
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed";

    // 变体样式映射（不同视觉风格）
    const variants = {
      primary:
        "bg-primary text-white hover:bg-primary/90 focus:ring-primary disabled:bg-primary/50 disabled:text-white/70",
      secondary:
        "border border-gray-100/60 bg-white text-primary hover:bg-surface focus:ring-primary/30 disabled:bg-surface disabled:text-steel/40",
      success:
        "bg-success text-white hover:bg-success/90 focus:ring-success disabled:bg-success/50 disabled:text-white/70",
      danger:
        "bg-alert text-white hover:bg-alert/90 focus:ring-alert disabled:bg-alert/50 disabled:text-white/70",
      ghost:
        "text-steel hover:text-primary hover:bg-surface focus:ring-primary/30 disabled:text-steel/40",
    };

    // 尺寸样式映射
    const sizes = {
      sm: "px-3 py-1.5 text-xs gap-1",
      md: "px-4 py-2 text-sm gap-1.5",
      lg: "px-6 py-3 text-base gap-2",
    };

    // 使用 clsx 安全合并所有类名（自动处理 false/undefined 值）
    const buttonClasses = clsx(
      baseStyles,
      variants[variant],
      sizes[size],
      {
        // 加载状态下，如果 hideTextOnLoading 为 true，则文字透明（视觉隐藏但占位）
        // 这样按钮宽度不会变化，避免布局抖动
        "text-transparent": isLoading && hideTextOnLoading,
      },
      className
    );

    // ----- 加载图标的处理 -----
    // 默认加载图标（SVG 环形动画）
    const defaultLoadingIcon = (
      <svg
        className="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true" // 装饰性图标，对屏幕阅读器隐藏
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    // 如果用户提供了自定义加载图标，则使用；否则使用默认
    const spinner = loadingIcon || defaultLoadingIcon;

    // ----- 可访问性（ARIA）属性 -----
    // 当加载时，通知屏幕阅读器按钮正在处理
    const ariaBusy = isLoading ? true : undefined;
    // 加载时禁用按钮，同时保持 disabled 属性
    const isDisabled = disabled || isLoading;

    // 为了更好的屏幕阅读器体验，可以动态更新按钮的标签（可选）
    // 但这里保持简洁，依赖已有的 aria-label 或 children

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={isDisabled}
        aria-busy={ariaBusy}
        aria-disabled={isDisabled} // 冗余但增强兼容性
        {...props}
      >
        {/* 加载图标：仅在 isLoading 时渲染 */}
        {isLoading && (
          <span
            className={clsx("inline-flex shrink-0", {
              // 如果 hideTextOnLoading 且没有其他内容，图标居中；否则正常
            })}
            aria-hidden="true"
          >
            {spinner}
          </span>
        )}

        {/* 按钮内容（文字或子元素） */}
        {!hideTextOnLoading && children}

        {/* 如果 hideTextOnLoading 为 true，但仍需要为屏幕阅读器提供可读内容（保留 children 但视觉隐藏） */}
        {hideTextOnLoading && isLoading && (
          <span className="sr-only">{children}</span>
        )}
      </button>
    );
  })
);

// 设置显示名称，便于调试
Button.displayName = "Button";

// 导出 memo 包装后的组件，避免不必要的重渲染
export default Button;