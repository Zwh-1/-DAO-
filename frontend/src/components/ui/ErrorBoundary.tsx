'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorAlert } from './ErrorAlert';
import { logError, ErrorCode, createError, type ErrorLevel, getUserFriendlyMessage, getErrorSuggestion } from '../../lib/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 错误边界组件
 * 
 * 功能：
 * - 捕获子组件树中的错误
 * - 展示友好的错误提示
 * - 提供恢复建议
 * - 记录错误日志（脱敏）
 * 
 * 使用示例：
 *   <ErrorBoundary name="ClaimForm">
 *     <ClaimForm />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.name || 'Boundary';
    
    // 1. 记录日志（脱敏处理）
    logError(error, componentName);
    
    // 2. 更新状态以使用 errorInfo
    this.setState({ errorInfo });
    
    // 3. 执行回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      /** * 核心修复：显式断言类型，解决无法分配给 ErrorLevel 的报错
       */
      const level = 'error' as ErrorLevel; 
      
      const appError = createError(
        error.message || '组件加载异常',
        ErrorCode.UNKNOWN_ERROR,
        level,
        error
      );

      // 获取用户友好的消息和恢复建议
      const userMessage = getUserFriendlyMessage(appError);
      const suggestion = getErrorSuggestion(appError);

      // 如果有自定义回退 UI，优先渲染
      if (fallback) {
        return <>{fallback}</>;
      }

      // 默认渲染医疗级 ErrorAlert
      return (
        <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <ErrorAlert
            type="error"
            title="组件加载异常"
            // 使用用户友好的消息
            message={userMessage}
            // 显示恢复建议
            suggestion={suggestion}
            dismissible={false}
            onRetry={this.resetErrorBoundary}
            showIcon={true}
          />
          
          {/* 开发环境展示堆栈信息（脱敏） */}
          {process.env.NODE_ENV === 'development' && errorInfo && (
            <div className="mt-4 p-3 bg-slate-50 rounded text-[10px] font-mono text-slate-400 overflow-auto max-h-32">
              <p className="font-bold mb-1 uppercase text-slate-500">Stack Trace:</p>
              {errorInfo.componentStack}
            </div>
          )}
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;