/**
 * ZK 证明生成 WebWorker
 * 
 * 功能：
 * - 在后台线程生成 zk 证明
 * - 避免阻塞主线程 UI
 * - 支持消息通信
 * 
 * 性能优化：
 * - 并行处理
 * - 不阻塞 UI
 * - 支持取消操作
 * 
 * 消息协议：
 * - 输入：{ type: 'GENERATE_PROOF', wasmPath, input }
 * - 输出：{ type: 'PROOF_GENERATED', proof, publicSignals, proofTime }
 * - 错误：{ type: 'ERROR', error }
 */

import { generateProof } from '../lib/zk/snarkjs';

/**
 * Worker 接收的消息
 */
interface WorkerMessage {
  /** 消息类型 */
  type: 'GENERATE_PROOF' | 'CANCEL';
  /** WASM 路径 */
  wasmPath?: string;
  /** 输入数据 */
  input?: Record<string, any>;
  /** 任务 ID（用于取消） */
  taskId?: string;
}

/**
 * Worker 发送的消息
 */
interface WorkerResponse {
  /** 消息类型 */
  type: 'PROOF_GENERATED' | 'ERROR' | 'PROGRESS';
  /** zk 证明 */
  proof?: any;
  /** 公开信号 */
  publicSignals?: string[];
  /** 证明生成时间 */
  proofTime?: number;
  /** 错误信息 */
  error?: string;
  /** 进度（0-100） */
  progress?: number;
  /** 任务 ID */
  taskId?: string;
}

/**
 * 当前任务
 */
let currentTask: {
  id: string;
  aborted: boolean;
} | null = null;

/**
 * 监听主线程消息
 */
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, wasmPath, input, taskId } = event.data;

  console.log('[Worker] 收到消息:', type);

  if (type === 'GENERATE_PROOF') {
    // 设置当前任务
    currentTask = {
      id: taskId || 'default',
      aborted: false,
    };

    try {
      // 发送进度更新
      const sendProgress = (progress: number) => {
        self.postMessage({
          type: 'PROGRESS',
          progress,
          taskId: currentTask?.id,
        } as WorkerResponse);
      };

      // 阶段 1: 加载 WASM（20%）
      sendProgress(20);

      // 阶段 2: 生成证明（80%）
      sendProgress(80);

      // 生成证明（需要 zkey 路径）
      const zkeyPath = wasmPath!.replace('.wasm', '.zkey');
      const { proof, publicSignals, proofTime } = await generateProof(
        wasmPath!,
        zkeyPath,
        input!
      );

      // 检查是否被取消
      if (currentTask?.aborted) {
        console.log('[Worker] 任务已取消');
        return;
      }

      // 发送结果
      self.postMessage({
        type: 'PROOF_GENERATED',
        proof,
        publicSignals,
        proofTime,
        taskId: currentTask.id,
      } as WorkerResponse);

      // 完成
      sendProgress(100);
    } catch (error) {
      // 发送错误
      self.postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : '证明生成失败',
        taskId: currentTask?.id,
      } as WorkerResponse);
    } finally {
      // 清除任务
      currentTask = null;
    }
  } else if (type === 'CANCEL') {
    // 取消任务
    if (currentTask && (!taskId || currentTask.id === taskId)) {
      currentTask.aborted = true;
      console.log('[Worker] 任务取消:', taskId);
    }
  }
});

/**
 * 导出 Worker
 */
export default self as unknown as Worker;
