"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  memo,
} from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LoadingSpinner } from "./Animations";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost" | "link";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  hideTextOnLoading?: boolean;
  loadingIcon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      hideTextOnLoading = false,
      loadingIcon,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className = "",
      disabled,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || isLoading;

    // 医疗级配色方案：高对比度、去渐变、严谨感
    // 严禁使用蓝紫渐变色，采用纯深蓝色 (#0A2540)
    const variants = {
      primary: "bg-[#0A2540] text-white hover:bg-[#0A2540]/90 active:bg-[#0A2540] focus:ring-[#0A2540]/30 shadow-sm disabled:bg-[#0A2540]/30 disabled:text-white/60",
      secondary: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-200 disabled:bg-gray-50 disabled:text-gray-300 shadow-sm",
      success: "bg-[#2D8A39] text-white hover:bg-[#2D8A39]/90 active:bg-[#2D8A39] focus:ring-[#2D8A39]/30 disabled:bg-[#2D8A39]/30 disabled:text-white/60 shadow-sm",
      danger: "bg-[#D93025] text-white hover:bg-[#D93025]/90 active:bg-[#D93025] focus:ring-[#D93025]/30 disabled:bg-[#D93025]/30 disabled:text-white/60 shadow-sm",
      ghost: "text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-200 disabled:text-gray-300",
      link: "text-[#0A2540] underline underline-offset-2 hover:text-[#0A2540]/80 focus:ring-[#0A2540]/30 disabled:text-gray-300 shadow-none",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg",
      md: "h-10 px-4 text-sm font-semibold gap-2 rounded-xl",
      lg: "h-12 px-6 text-base font-bold gap-2.5 rounded-xl",
      xl: "h-14 px-8 text-base font-bold gap-3 rounded-2xl",
    };

    const ariaAttributes = {
      "aria-busy": isLoading ? ("true" as const) : undefined,
      "aria-disabled": isDisabled ? ("true" as const) : undefined,
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        {...ariaAttributes}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg transition-all duration-200",
          "select-none focus:outline-none focus:ring-2 focus:ring-offset-1",
          "active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
          "whitespace-nowrap",
          fullWidth && "w-full",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {/* 加载图标层 - 使用统一的 LoadingSpinner 组件 */}
        {isLoading && (
          <div className={cn(
            "flex items-center justify-center",
            hideTextOnLoading ? "absolute inset-0" : ""
          )}>
            <LoadingSpinner 
              size={size === 'sm' ? 'sm' : size === 'xl' ? 'lg' : 'md'} 
              color={variant === 'ghost' || variant === 'link' ? 'primary' : 'white'} 
            />
          </div>
        )}

        {/* 左侧图标 */}
        {!isLoading && leftIcon && (
          <span className={cn(
            "flex items-center",
            !children && "mr-0"
          )}>
            {leftIcon}
          </span>
        )}

        {/* 文字内容层 */}
        <span className={cn(
          "inline-flex items-center justify-center gap-[inherit]",
          isLoading && hideTextOnLoading ? "opacity-0" : "opacity-100",
          !isLoading && !children && "sr-only"
        )}>
          {children}
        </span>

        {/* 右侧图标 */}
        {!isLoading && rightIcon && (
          <span className="flex items-center">
            {rightIcon}
          </span>
        )}

        {/* 无障碍阅读提示 */}
        {isLoading && hideTextOnLoading && (
          <span className="sr-only">正在加载...</span>
        )}
      </button>
    );
  })
);

Button.displayName = "Button";
export default Button;