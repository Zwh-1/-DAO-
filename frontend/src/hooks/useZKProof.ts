/**
 * ZK 证明生成 Hook（基于 Web Worker）
 * 
 * 设计目标：
 * 1. 封装 Web Worker 通信细节
 * 2. 提供声明式 API（类似 React Query）
 * 3. 支持进度反馈和取消操作
 * 4. WASM 预加载优化
 * 
 * 性能指标：
 * - 主线程占用 < 5%
 * - UI 帧率保持 60fps
 * - 证明生成耗时：3-5 秒
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ==================== 类型定义 ====================

/**
 * 证明生成进度
 */
interface ProofProgress {
  phase: 'wasm_loading' | 'zkey_loading' | 'proving';
  progress: number; // 0-1
  message?: string;
}

/**
 * 证明生成结果
 */
interface ProofResult {
  proof: any;
  publicSignals: any;
  duration: number; // 毫秒
}

/**
 * Hook 返回值
 */
interface UseZKProofReturn {
  // 状态
  isInitializing: boolean;
  isGenerating: boolean;
  progress: ProofProgress | null;
  error: string | null;
  errorCode: string | null;
  
  // 结果
  lastResult: ProofResult | null;
  
  // 操作
  initialize: (wasmUrl: string, zkeyUrl: string) => Promise<void>;
  generateProof: (witness: any, circuitName?: string) => Promise<ProofResult>;
  preloadWasm: (wasmUrl: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

// ==================== Worker 消息类型 ====================

type WorkerRequest =
  | { type: 'INIT'; payload: { wasmUrl: string; zkeyUrl: string } }
  | { type: 'GENERATE_PROOF'; payload: { witness: any; circuitName?: string } }
  | { type: 'PRELOAD_WASM'; payload: { wasmUrl: string } }
  | { type: 'CANCEL' };

type WorkerResponse =
  | { type: 'INIT_SUCCESS'; payload: { message: string } }
  | { type: 'INIT_ERROR'; payload: { error: string } }
  | { type: 'PROOF_GENERATED'; payload: { proof: any; publicSignals: any; duration: number } }
  | { type: 'PROOF_PROGRESS'; payload: ProofProgress }
  | { type: 'PROOF_ERROR'; payload: { error: string; code?: string } }
  | { type: 'WASM_PRELOADED'; payload: { wasmUrl: string } };

// ==================== 主 Hook ====================

/**
 * ZK 证明生成 Hook
 */
export function useZKProof(): UseZKProofReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProofProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ProofResult | null>(null);
  
  // Promise 解析器引用
  const resolverRef = useRef<{
    resolve: (result: ProofResult) => void;
    reject: (error: any) => void;
  } | null>(null);

  // ==================== Worker 初始化 ====================
  
  useEffect(() => {
    // 创建 Worker（动态导入，支持热更新）
    const worker = new Worker(new URL('@/workers/zk.worker.ts', import.meta.url));
    workerRef.current = worker;
    
    // 监听 Worker 消息
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      console.log('[useZKProof] Worker 响应:', response.type);
      
      switch (response.type) {
        case 'INIT_SUCCESS':
          setIsInitializing(false);
          setIsInitialized(true);
          setError(null);
          setErrorCode(null);
          console.log('[useZKProof] ZK 环境初始化完成');
          break;
        
        case 'INIT_ERROR':
          setIsInitializing(false);
          setError(response.payload.error);
          setErrorCode('INIT_FAILED');
          console.error('[useZKProof] 初始化失败:', response.payload.error);
          break;
        
        case 'PROOF_PROGRESS':
          setProgress(response.payload);
          console.log('[useZKProof] 进度:', response.payload);
          break;
        
        case 'PROOF_GENERATED':
          setIsGenerating(false);
          setProgress(null);
          setLastResult(response.payload);
          
          // 解析 Promise
          if (resolverRef.current) {
            resolverRef.current.resolve(response.payload);
            resolverRef.current = null;
          }
          console.log('[useZKProof] 证明生成完成，耗时:', response.payload.duration, 'ms');
          break;
        
        case 'PROOF_ERROR':
          setIsGenerating(false);
          setProgress(null);
          setError(response.payload.error);
          setErrorCode(response.payload.code ?? 'PROOF_FAILED');
          
          // 拒绝 Promise
          if (resolverRef.current) {
            const error = new Error(response.payload.error);
            error.name = response.payload.code ?? 'PROOF_FAILED';
            resolverRef.current.reject(error);
            resolverRef.current = null;
          }
          console.error('[useZKProof] 证明生成失败:', response.payload.error);
          break;
        
        case 'WASM_PRELOADED':
          console.log('[useZKProof] WASM 预加载完成:', response.payload.wasmUrl);
          break;
      }
    };
    
    // 监听 Worker 错误
    worker.onerror = (error) => {
      console.error('[useZKProof] Worker 错误:', error);
      setError(error.message);
      setErrorCode('WORKER_ERROR');
      
      if (resolverRef.current) {
        resolverRef.current.reject(error);
        resolverRef.current = null;
      }
    };
    
    // 清理
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ==================== Actions ====================
  
  /**
   * 初始化 ZK 环境（加载 WASM 和 ZKey）
   */
  const initialize = useCallback(async (wasmUrl: string, zkeyUrl: string) => {
    if (!workerRef.current) {
      throw new Error('Worker 未初始化');
    }
    
    setIsInitializing(true);
    setError(null);
    setErrorCode(null);
    
    // 发送初始化请求
    workerRef.current.postMessage({
      type: 'INIT',
      payload: { wasmUrl, zkeyUrl }
    });
    
    // 返回 Promise（在 onmessage 中解析）
    return new Promise<void>((resolve, reject) => {
      // 超时处理
      const timeout = setTimeout(() => {
        reject(new Error('初始化超时'));
      }, 30000); // 30 秒超时
      
      // 临时监听 INIT_SUCCESS
      const originalOnMessage = workerRef.current!.onmessage;
      workerRef.current!.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (originalOnMessage) {
          originalOnMessage.call(workerRef.current!, event);
        }
        
        if (event.data.type === 'INIT_SUCCESS') {
          clearTimeout(timeout);
          resolve();
        } else if (event.data.type === 'INIT_ERROR') {
          clearTimeout(timeout);
          reject(new Error(event.data.payload.error));
        }
      };
    });
  }, []);
  
  /**
   * 生成零知识证明
   */
  const generateProof = useCallback(async (
    witness: any,
    circuitName?: string
  ): Promise<ProofResult> => {
    if (!workerRef.current) {
      throw new Error('Worker 未初始化');
    }
    
    if (!isInitialized) {
      throw new Error('ZK 环境未初始化，请先调用 initialize()');
    }
    
    setIsGenerating(true);
    setError(null);
    setErrorCode(null);
    setProgress(null);
    
    // 发送生成请求
    workerRef.current.postMessage({
      type: 'GENERATE_PROOF',
      payload: { witness, circuitName }
    });
    
    // 返回 Promise（在 onmessage 中解析）
    return new Promise<ProofResult>((resolve, reject) => {
      resolverRef.current = { resolve, reject };
    });
  }, [isInitialized]);
  
  /**
   * 预加载 WASM（可选优化）
   */
  const preloadWasm = useCallback(async (wasmUrl: string) => {
    if (!workerRef.current) {
      throw new Error('Worker 未初始化');
    }
    
    workerRef.current.postMessage({
      type: 'PRELOAD_WASM',
      payload: { wasmUrl }
    });
    
    return new Promise<void>((resolve) => {
      const handler = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'WASM_PRELOADED') {
          workerRef.current!.removeEventListener('message', handler);
          resolve();
        }
      };
      workerRef.current!.addEventListener('message', handler);
    });
  }, []);
  
  /**
   * 取消当前证明生成
   */
  const cancel = useCallback(() => {
    if (workerRef.current && isGenerating) {
      workerRef.current.postMessage({ type: 'CANCEL' });
      console.log('[useZKProof] 取消证明生成');
    }
  }, [isGenerating]);
  
  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress(null);
    setError(null);
    setErrorCode(null);
    resolverRef.current = null;
  }, []);
  
  // ==================== 返回值 ====================
  
  return {
    // 状态
    isInitializing,
    isGenerating,
    progress,
    error,
    errorCode,
    
    // 结果
    lastResult,
    
    // 操作
    initialize,
    generateProof,
    preloadWasm,
    cancel,
    reset,
  };
}
