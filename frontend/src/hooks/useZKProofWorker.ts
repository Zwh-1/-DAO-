/**
 * WebWorker Hook - ZK 证明生成
 * 
 * 功能：
 * - 创建和管理 WebWorker
 * - 发送证明生成任务
 * - 监听进度和结果
 * 
 * 性能优化：
 * - 避免阻塞主线程
 * - 支持任务取消
 * - 支持进度回调
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Worker 状态
 */
interface WorkerState {
  /** 是否正在生成 */
  isGenerating: boolean;
  /** 进度（0-100） */
  progress: number;
  /** 错误信息 */
  error: string | null;
  /** 证明生成时间 */
  proofTime: number | null;
}

/**
 * 证明生成参数
 */
export interface ProofGenerationRequest {
  /** WASM 路径 */
  wasmPath: string;
  /** 输入数据 */
  input: Record<string, any>;
}

/**
 * 证明生成结果
 */
export interface ProofGenerationResult {
  /** zk 证明 */
  proof: any;
  /** 公开信号 */
  publicSignals: string[];
  /** 证明生成时间 */
  proofTime: number;
}

/**
 * WebWorker Hook - ZK 证明生成
 */
export function useZKProofWorker() {
  const [state, setState] = useState<WorkerState>({
    isGenerating: false,
    progress: 0,
    error: null,
    proofTime: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const taskIdRef = useRef<string>('');

  /**
   * 初始化 Worker
   */
  useEffect(() => {
    // 创建 Worker
    workerRef.current = new Worker(
      new URL('../workers/zkProofWorker.ts', import.meta.url)
    );

    // 监听 Worker 消息
    workerRef.current.onmessage = (event) => {
      const { type, progress, error, proofTime, proof, publicSignals } = event.data;

      console.log('[WorkerHook] 收到消息:', type);

      if (type === 'PROGRESS') {
        setState((prev) => ({ ...prev, progress }));
      } else if (type === 'ERROR') {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error,
        }));
      } else if (type === 'PROOF_GENERATED') {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          progress: 100,
          proofTime,
        }));
      }
    };

    // 清理
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * 生成证明
   */
  const generateProof = useCallback(async (
    request: ProofGenerationRequest
  ): Promise<ProofGenerationResult | null> => {
    if (!workerRef.current) {
      throw new Error('Worker 未初始化');
    }

    // 生成任务 ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    taskIdRef.current = taskId;

    // 重置状态
    setState({
      isGenerating: true,
      progress: 0,
      error: null,
      proofTime: null,
    });

    // 发送任务
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve(null);
        return;
      }

      // 监听一次消息
      const handleMessage = (event: MessageEvent) => {
        const { type, proof, publicSignals, proofTime, error, taskId: responseTaskId } = event.data;

        // 只处理当前任务的消息
        if (responseTaskId !== taskId) {
          return;
        }

        // 移除监听
        workerRef.current!.removeEventListener('message', handleMessage);

        if (type === 'PROOF_GENERATED') {
          resolve({
            proof,
            publicSignals,
            proofTime,
          });
        } else if (type === 'ERROR') {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error,
          }));
          resolve(null);
        }
      };

      // 添加监听
      workerRef.current.addEventListener('message', handleMessage);

      // 发送消息
      workerRef.current.postMessage({
        type: 'GENERATE_PROOF',
        wasmPath: request.wasmPath,
        input: request.input,
        taskId,
      });
    });
  }, []);

  /**
   * 取消生成
   */
  const cancelGeneration = useCallback(() => {
    if (!workerRef.current || !taskIdRef.current) {
      return;
    }

    // 发送取消消息
    workerRef.current.postMessage({
      type: 'CANCEL',
      taskId: taskIdRef.current,
    });

    // 重置状态
    setState((prev) => ({
      ...prev,
      isGenerating: false,
      error: '已取消',
    }));
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      progress: 0,
      error: null,
      proofTime: null,
    });
  }, []);

  return {
    ...state,
    generateProof,
    cancelGeneration,
    reset,
  };
}

/**
 * 导出默认 Hook
 */
export default useZKProofWorker;
