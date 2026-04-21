/**
 * 统一错误提示组件
 * 
 * 功能：
 * - 统一错误展示样式
 * - 支持错误类型分类
 * - 支持自动Dismiss
 * - 支持重试操作
 * 
 * 错误类型：
 * - Error: 普通错误（红色）
 * - Warning: 警告（黄色）
 * - Info: 信息（蓝色）
 * - Success: 成功（绿色）
 * 
 * 视觉规范：
 * - 医疗级专业配色
 * - 严禁蓝紫渐变色
 * - 高对比度、清晰易读
 */

'use client';

import React, { useEffect, useState } from 'react';

/**
 * 错误类型
 */
export type ErrorType = 'error' | 'warning' | 'info' | 'success';

/**
 * 错误提示属性
 */
export interface ErrorAlertProps {
  /** 错误类型 */
  type?: ErrorType;
  /** 错误标题 */
  title?: string;
  /** 错误消息 */
  message: string;
  /** 恢复建议 */
  suggestion?: string;
  /** 是否可关闭 */
  dismissible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 重试操作 */
  onRetry?: () => void;
  /** 自动关闭时间（毫秒，0 为不自动关闭） */
  autoDismissTime?: number;
  /** 是否显示图标 */
  showIcon?: boolean;
}

/**
 * 错误类型配置
 */
const ERROR_CONFIGS: Record<ErrorType, {
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  label: string;
}> = {
  error: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    icon: '❌',
    label: '错误',
  },
  warning: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    icon: '⚠️',
    label: '警告',
  },
  info: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: 'ℹ️',
    label: '提示',
  },
  success: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    icon: '✅',
    label: '成功',
  },
};

/**
 * 统一错误提示组件
 */
export function ErrorAlert({
  type = 'error',
  title,
  message,
  suggestion,
  dismissible = true,
  onClose,
  onRetry,
  autoDismissTime = 0,
  showIcon = true,
}: ErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  const config = ERROR_CONFIGS[type];

  /**
   * 自动关闭
   */
  useEffect(() => {
    if (autoDismissTime > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoDismissTime);

      return () => clearTimeout(timer);
    }
  }, [autoDismissTime]);

  /**
   * 关闭处理
   */
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`
        ${config.bgColor}
        ${config.borderColor}
        border
        rounded-lg
        px-4
        py-3
        transition-all
        duration-300
      `}
      role="alert"
    >
      <div className="flex items-start">
        {/* 图标 */}
        {showIcon && (
          <div className="flex-shrink-0 text-xl mr-3">
            {config.icon}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1">
          {/* 标题 */}
          {title && (
            <h4 className={`font-medium ${config.textColor} mb-1`}>
              {title}
            </h4>
          )}

          {/* 消息 */}
          <p className={`text-sm ${config.textColor}`}>
            {message}
          </p>

          {/* 恢复建议 */}
          {suggestion && (
            <div className={`mt-2 p-2 rounded bg-opacity-10 bg-gray-500`}>
              <p className={`text-xs ${config.textColor} font-medium`}>
                💡 建议：{suggestion}
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className={`
                  px-4 py-2
                  ${config.textColor.replace('text-', 'bg-').replace('700', '600')}
                  text-white
                  text-sm
                  font-medium
                  rounded-md
                  hover:opacity-90
                  transition-opacity
                `}
              >
                🔄 重试
              </button>
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        {dismissible && (
          <button
            onClick={handleClose}
            className={`
              flex-shrink-0
              ml-4
              -mx-1.5
              -my-1.5
              rounded-lg
              focus:ring-2
              ${config.textColor}
              hover:bg-opacity-20
              hover:bg-gray-500
              p-1.5
              transition-colors
            `}
            aria-label="关闭"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 导出默认组件
 */
export default ErrorAlert;
