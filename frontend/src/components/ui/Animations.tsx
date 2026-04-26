/**
 * 动画组件库
 * 
 * 功能：
 * - 提供统一的动画效果
 * - 支持进入、退出、加载、成功等状态
 * - 符合医疗级专业规范
 * 
 * 视觉规范：
 * - 流畅的过渡效果（duration-200）
 * - 医疗蓝配色主题
 * - 无蓝紫渐变色
 */

'use client';

import React from 'react';

// ==================== 加载动画 ====================

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'alert' | 'white';
  text?: string;
}

export function LoadingSpinner({ size = 'md', color = 'primary', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };

  const colorClasses = {
    primary: 'text-[#0A2540]',
    success: 'text-[#2D8A39]',
    alert: 'text-[#D93025]',
    white: 'text-white',
  };

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <svg
        className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
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
      {text && (
        <span className={`text-sm ${color === 'white' ? 'text-white' : 'text-steel'}`}>
          {text}
        </span>
      )}
    </div>
  );
}

// ==================== 脉冲动画 ====================

export interface PulseDotProps {
  color?: 'success' | 'alert' | 'warning' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}

export function PulseDot({ color = 'success', size = 'md', ariaLabel }: PulseDotProps) {
  const colorClasses = {
    success: 'bg-[#2D8A39]',
    alert: 'bg-[#D93025]',
    warning: 'bg-[#F59E0B]',
    primary: 'bg-[#0A2540]',
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={`relative flex ${sizeClasses[size]}`}
      aria-label={ariaLabel || '状态指示器'}
    >
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorClasses[color]}`}
      />
      <span
        className={`relative inline-flex rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
      />
    </span>
  );
}

// ==================== 淡入动画容器 ====================

export interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 200, className = '' }: FadeInProps) {
  return (
    <div
      className={`animate-in fade-in ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// ==================== 缩放动画容器 ====================

export interface ZoomInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function ZoomIn({ children, delay = 0, duration = 200, className = '' }: ZoomInProps) {
  return (
    <div
      className={`animate-in zoom-in ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// ==================== 滑动动画容器 ====================

export interface SlideInProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  className?: string;
}

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 200,
  className = '',
}: SlideInProps) {
  const directionClasses = {
    up: 'slide-in-from-bottom',
    down: 'slide-in-from-top',
    left: 'slide-in-from-left',
    right: 'slide-in-from-right',
  };

  return (
    <div
      className={`animate-in ${directionClasses[direction]} ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// ==================== 成功动画 ====================

export interface SuccessCheckProps {
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
}

export function SuccessCheck({ size = 'md', showAnimation = true }: SuccessCheckProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-success/10 ${sizeClasses[size]}`}
    >
      <svg
        className={`w-6 h-6 text-success ${showAnimation ? 'animate-in zoom-in duration-200' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
      </svg>
    </div>
  );
}

// ==================== 错误动画 ====================

export interface ErrorIconProps {
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
}

export function ErrorIcon({ size = 'md', showAnimation = true }: ErrorIconProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-alert/10 ${sizeClasses[size]}`}
    >
      <svg
        className={`w-6 h-6 text-alert ${showAnimation ? 'animate-in zoom-in duration-200' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </div>
  );
}

// ==================== 默认导出 ====================

export default {
  LoadingSpinner,
  PulseDot,
  FadeIn,
  ZoomIn,
  SlideIn,
  SuccessCheck,
  ErrorIcon,
};
