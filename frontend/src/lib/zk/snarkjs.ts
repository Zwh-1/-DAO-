/**
 * snarkjs 工具封装
 * 
 * 功能：
 * - 加载电路 WASM
 * - 生成 zk 证明
 * - 验证证明
 * 
 * 隐私保护：
 * - Witness 数据不离端
 * - 证明在本地生成
 * - 不记录敏感数据到日志
 * 
 * 性能优化：
 * - WebWorker 并行处理
 * - WASM 分段加载
 * - 内存管理
 */

import type { Groth16Proof, PublicSignals } from 'snarkjs';

/**
 * 证明生成结果
 */
export interface ProofResult {
  /** zk 证明 */
  proof: Groth16Proof;
  /** 公开信号 */
  publicSignals: PublicSignals;
  /** 证明生成时间（毫秒） */
  proofTime: number;
}

/**
 * 电路加载结果
 */
export interface CircuitData {
  /** 电路 WASM 路径 */
  wasmPath: string;
  /** 证明密钥路径 */
  zkeyPath: string;
  /** 验证密钥路径（可选） */
  vkeyPath?: string;
}

/**
 * 加载电路 WASM
 * 
 * @param wasmPath WASM 文件路径
 * @returns 电路实例
 */
export async function loadCircuit(wasmPath: string): Promise<any> {
  console.log('[ZK] 加载电路:', wasmPath);
  
  try {
    // 动态导入 snarkjs
    const snarkjs = await import('snarkjs');
    
    // 加载 WASM
    const wasmBuffer = await fetch(wasmPath).then((res) => res.arrayBuffer());
    
    console.log('[ZK] 电路加载完成');
    
    // 返回 WASM buffer（snarkjs 内部会处理）
    return wasmBuffer;
  } catch (error) {
    console.error('[ZK] 电路加载失败:', error);
    throw new Error(`电路加载失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 生成 zk 证明（Groth16）
 * 
 * @param wasmPath WASM 文件路径
 * @param zkeyPath 证明密钥路径
 * @param input 输入数据（Witness）
 * @returns 证明结果
 */
export async function generateProof(
  wasmPath: string,
  zkeyPath: string,
  input: Record<string, any>
): Promise<ProofResult> {
  console.log('[ZK] 开始生成证明:', {
    wasmPath,
    zkeyPath,
    inputKeys: Object.keys(input),
  });
  
  const startTime = Date.now();
  
  try {
    // 动态导入 snarkjs
    const snarkjs = await import('snarkjs');
    
    // 加载 WASM（转换为 Uint8Array）
    const wasmBuffer = await fetch(wasmPath).then((res) => res.arrayBuffer());
    const wasmBytes = new Uint8Array(wasmBuffer);
    
    // 加载 zkey
    const zkeyBuffer = await fetch(zkeyPath).then((res) => res.arrayBuffer());
    const zkeyBytes = new Uint8Array(zkeyBuffer);
    
    // ✅ fullProve 需要 3 个参数：input, wasm, zkey
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmBytes,
      zkeyBytes
    );
    
    const proofTime = Date.now() - startTime;
    
    console.log('[ZK] 证明生成完成:', {
      proofTime: `${proofTime}ms`,
      publicSignalsCount: publicSignals.length,
    });
    
    return {
      proof,
      publicSignals,
      proofTime,
    };
  } catch (error) {
    console.error('[ZK] 证明生成失败:', error);
    throw new Error(`证明生成失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 验证 zk 证明
 * 
 * @param proof zk 证明
 * @param publicSignals 公开信号
 * @param vkeyPath 验证密钥路径
 * @returns 验证结果（true/false）
 */
export async function verifyProof(
  proof: Groth16Proof,
  publicSignals: PublicSignals,
  vkeyPath: string
): Promise<boolean> {
  console.log('[ZK] 验证证明');
  
  try {
    // 动态导入 snarkjs
    const snarkjs = await import('snarkjs');
    
    // 加载验证密钥
    const vkeyBuffer = await fetch(vkeyPath).then((res) => res.arrayBuffer());
    const vkey = JSON.parse(new TextDecoder().decode(vkeyBuffer));
    
    // 验证证明
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    console.log('[ZK] 验证结果:', isValid ? '有效' : '无效');
    
    return isValid;
  } catch (error) {
    console.error('[ZK] 验证失败:', error);
    throw new Error(`验证失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 计算电路输入
 * 
 * 用于准备证明生成的输入数据
 * 
 * @param circuitName 电路名称
 * @param params 参数
 * @returns 电路输入
 */
export function calculateCircuitInput(
  circuitName: string,
  params: Record<string, any>
): Record<string, any> {
  console.log('[ZK] 计算电路输入:', circuitName);
  
  switch (circuitName) {
    case 'identity':
      return {
        socialIdHash: params.socialIdHash,
        secret: params.secret,
        trapdoor: params.trapdoor,
      };
    
    case 'anonymousClaim':
      return {
        secret: params.secret,
        leaf_index: params.leaf_index,
        merkle_path: params.merkle_path,
        airdrop_id: params.airdrop_id,
        merkle_root: params.merkle_root,
        nullifier: params.nullifier,
        commitment: params.commitment,
        claim_amount: params.claim_amount,
        current_timestamp: params.current_timestamp,
        ts_start: params.ts_start,
        ts_end: params.ts_end,
      };
    
    default:
      throw new Error(`未知电路：${circuitName}`);
  }
}

/**
 * 格式化证明为 JSON
 * 
 * 用于发送到后端 API
 */
export function formatProofToJson(proof: Groth16Proof): Record<string, any> {
  return {
    pi_a: proof.pi_a,
    pi_b: proof.pi_b,
    pi_c: proof.pi_c,
  };
}

/**
 * 导出所有工具
 */
export const zkUtils = {
  loadCircuit,
  generateProof,
  verifyProof,
  calculateCircuitInput,
  formatProofToJson,
};
