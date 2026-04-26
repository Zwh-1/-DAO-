/**
 * 文件上传 Hook
 * 
 * 职责：
 * - 管理文件选择状态
 * - 处理文件校验
 * - 执行上传请求
 * - 追踪上传进度
 * - 错误处理与降级
 * 
 * 使用示例：
 * ```tsx
 * const {
 *   files,
 *   setFiles,
 *   handleFileChange,
 *   removeFile,
 *   upload,
 *   isUploading,
 *   error,
 *   clearError,
 * } = useFileUpload({
 *   endpoint: '/v1/claim/:claimId/evidence',
 *   maxFiles: 5,
 *   maxSize: 10 * 1024 * 1024,
 *   onUploadSuccess: (cid) => console.log('上传成功:', cid),
 *   onUploadError: (err) => console.error('上传失败:', err),
 * });
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import {
  validateFiles,
  uploadFilesWithFallback,
  FileValidationError,
} from '../lib/utils/file';

/** 文件元数据接口 */
export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

/** Hook 配置接口 */
export interface UseFileUploadOptions {
  /** 上传接口路径 */
  endpoint: string | ((...args: unknown[]) => string);
  /** 最大文件数（默认 5） */
  maxFiles?: number;
  /** 单文件最大大小（默认 10MB） */
  maxSize?: number;
  /** 上传成功回调 */
  onUploadSuccess?: (cid: string) => void;
  /** 上传失败回调 */
  onUploadError?: (error: Error) => void;
  /** 是否启用降级（默认 true） */
  enableFallback?: boolean;
  /** 降级返回值（默认 'pending'） */
  fallbackValue?: string;
}

/** Hook 返回值接口 */
export interface UseFileUploadReturn {
  /** 已选择的文件元数据 */
  files: FileMeta[];
  /** 原始 File 对象（用于上传） */
  fileObjects: File[];
  /** 文件输入框 change 事件处理器 */
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** 手动设置文件 */
  setFiles: (files: File[]) => void;
  /** 移除指定文件 */
  removeFile: (index: number) => void;
  /** 清空所有文件 */
  clearFiles: () => void;
  /** 执行上传 */
  upload: (extraParams?: Record<string, unknown>) => Promise<string>;
  /** 是否正在上传 */
  isUploading: boolean;
  /** 上传进度（0-100） */
  progress: number;
  /** 错误信息 */
  error: string | null;
  /** 清除错误 */
  clearError: () => void;
  /** 文件输入框 ref */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * 文件上传 Hook
 */
export function useFileUpload(options: UseFileUploadOptions): UseFileUploadReturn {
  const {
    endpoint,
    maxFiles = 5,
    maxSize = 10 * 1024 * 1024,
    onUploadSuccess,
    onUploadError,
    enableFallback = true,
    fallbackValue = 'pending',
  } = options;

  const [files, setFilesState] = useState<FileMeta[]>([]);
  const [fileObjects, setFileObjects] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理文件选择
   */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    
    // 校验文件数量
    if (selectedFiles.length > maxFiles) {
      setError(`文件数量过多：${selectedFiles.length}（最多 ${maxFiles} 个）`);
      return;
    }

    // 校验文件大小
    for (const file of selectedFiles) {
      if (file.size > maxSize) {
        setError(`文件过大：${file.name}（最大 ${(maxSize / 1024 / 1024).toFixed(0)}MB）`);
        return;
      }
    }

    // 更新状态
    setFilesState(selectedFiles.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    })));
    setFileObjects(selectedFiles);
    setError(null);
  }, [maxFiles, maxSize]);

  /**
   * 手动设置文件
   */
  const setFiles = useCallback((newFiles: File[]) => {
    setFilesState(newFiles.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    })));
    setFileObjects(newFiles);
  }, []);

  /**
   * 移除指定文件
   */
  const removeFile = useCallback((index: number) => {
    setFilesState((prev) => prev.filter((_, i) => i !== index));
    setFileObjects((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 清空所有文件
   */
  const clearFiles = useCallback(() => {
    setFilesState([]);
    setFileObjects([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 执行上传
   */
  const upload = useCallback(async (extraParams?: Record<string, unknown>): Promise<string> => {
    if (fileObjects.length === 0) {
      return fallbackValue;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 校验文件
      validateFiles(fileObjects);
      setProgress(30);

      // 构建上传端点
      const uploadEndpoint = typeof endpoint === 'function'
        ? endpoint(...(extraParams ? [extraParams] : []))
        : endpoint;

      setProgress(50);

      // 执行上传
      const result = enableFallback
        ? await uploadFilesWithFallback(uploadEndpoint, fileObjects, fallbackValue)
        : await uploadFilesWithFallback(uploadEndpoint, fileObjects);

      setProgress(100);

      // 成功回调
      onUploadSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传失败';
      setError(errorMessage);
      onUploadError?.(err instanceof Error ? err : new Error(errorMessage));
      return fallbackValue;
    } finally {
      setIsUploading(false);
    }
  }, [fileObjects, endpoint, enableFallback, fallbackValue, onUploadSuccess, onUploadError]);

  return {
    files,
    fileObjects,
    handleFileChange,
    setFiles,
    removeFile,
    clearFiles,
    upload,
    isUploading,
    progress,
    error,
    clearError,
    fileInputRef,
  };
}
