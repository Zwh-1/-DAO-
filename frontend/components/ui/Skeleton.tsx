/**
 * 骨架屏组件库
 * 
 * 功能：
 * - 提供统一的加载占位效果
 * - 支持多种布局（文本、圆形、卡片）
 * - 流畅的脉冲动画
 * 
 * 视觉规范：
 * - 使用医疗级灰色调
 * - 柔和的脉冲动画
 * - 无蓝紫渐变色
 */

'use client';

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==================== 基础骨架屏 ====================

export interface SkeletonProps {
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
  duration?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ 
  className = '', 
  animation = 'pulse',
  duration = 1500,
  style,
}: SkeletonProps) {
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-gray-200 rounded-lg',
        animationClasses[animation],
        className
      )}
      style={{
        ...style,
        animationDuration: animation !== 'none' ? `${duration}ms` : undefined,
      }}
      aria-hidden="true"
      role="status"
    />
  );
}

// ==================== 文本骨架屏 ====================

export interface SkeletonTextProps {
  lines?: number;
  spacing?: 'sm' | 'md' | 'lg';
  width?: string | string[];
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function SkeletonText({
  lines = 3,
  spacing = 'md',
  width = ['100%', '90%', '80%'],
  className = '',
  animation = 'pulse',
}: SkeletonTextProps) {
  const spacingClasses = {
    sm: 'space-y-1',
    md: 'space-y-2',
    lg: 'space-y-3',
  };

  const getWidth = (index: number) => {
    if (typeof width === 'string') return width;
    return width[index % width.length];
  };

  return (
    <div className={cn(spacingClasses[spacing], className)} role="status" aria-label="加载中">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 rounded"
          animation={animation}
          style={{ width: getWidth(i) }}
        />
      ))}
    </div>
  );
}

// ==================== 圆形骨架屏 ====================

export interface SkeletonCircleProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function SkeletonCircle({
  size = 'md',
  className = '',
  animation = 'pulse',
}: SkeletonCircleProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-full',
    md: 'w-10 h-10 rounded-full',
    lg: 'w-12 h-12 rounded-full',
    xl: 'w-16 h-16 rounded-full',
  };

  return (
    <Skeleton
      className={cn(sizeClasses[size], className)}
      animation={animation}
    />
  );
}

// ==================== 卡片骨架屏 ====================

export interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
  animation?: 'pulse' | 'wave' | 'none';
}

export function SkeletonCard({
  className = '',
  showImage = true,
  showTitle = true,
  showDescription = true,
  showFooter = false,
  animation = 'pulse',
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 p-4 space-y-3',
        className
      )}
      role="status"
      aria-label="卡片加载中"
    >
      {/* 图片区域 */}
      {showImage && (
        <Skeleton 
          className="w-full h-32 rounded-lg" 
          animation={animation}
        />
      )}

      {/* 标题 */}
      {showTitle && (
        <Skeleton 
          className="h-6 w-3/4 rounded" 
          animation={animation}
        />
      )}

      {/* 描述 */}
      {showDescription && (
        <SkeletonText 
          lines={2} 
          spacing="sm" 
          animation={animation}
        />
      )}

      {/* 底部 */}
      {showFooter && (
        <div className="flex gap-2 pt-2">
          <Skeleton 
            className="h-8 w-20 rounded-lg" 
            animation={animation}
          />
          <Skeleton 
            className="h-8 w-20 rounded-lg" 
            animation={animation}
          />
        </div>
      )}
    </div>
  );
}

// ==================== 表格骨架屏 ====================

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
  animation = 'pulse',
}: SkeletonTableProps) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="表格加载中">
      {/* 表头 */}
      <div className="flex gap-4 px-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className="h-4 flex-1 rounded"
            animation={animation}
          />
        ))}
      </div>

      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 px-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-4 flex-1 rounded"
              animation={animation}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ==================== 默认导出 ====================

export default {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonCard,
  SkeletonTable,
};
