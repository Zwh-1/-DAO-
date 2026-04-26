/**
 * 身份注册 Hook
 * 
 * 功能：
 * - 前端计算 commitment
 * - 调用后端 API 注册
 * - 管理注册状态
 * 
 * 隐私保护：
 * - secret 在前端生成并计算 commitment
 * - secret 不传输到后端
 * - 仅发送 commitment 到后端
 * 
 * 流程：
 * 1. 生成随机 secret
 * 2. 计算 commitment = PoseidonHash([socialIdHash, secret])
 * 3. 调用 identityApi.register(commitment, level)
 * 4. 保存 secret 到本地存储（用于后续证明生成）
 */

import { useState, useCallback } from 'react';
import { identityApi } from '../lib/api/identity';
import { calculateCommitment, generateSecret, formatBigInt, stringToBigInt } from '../lib/zk/poseidon';

/**
 * 身份注册状态
 */
interface IdentityRegistrationState {
  /** 是否正在注册 */
  isRegistering: boolean;
  /** 是否已注册成功 */
  isRegistered: boolean;
  /** 错误信息 */
  error: string | null;
  /** Commitment */
  commitment: bigint | null;
  /** Merkle Root */
  merkleRoot: string | null;
  /** Merkle Leaf */
  merkleLeaf: string | null;
}

/**
 * 身份注册结果
 */
export interface RegistrationResult {
  /** 承诺哈希 */
  commitment: bigint;
  /** Secret（用于后续证明生成） */
  secret: Uint8Array;
  /** Merkle 根 */
  merkleRoot: string;
  /** Merkle 叶子 */
  merkleLeaf: string;
  /** 等级 */
  level: number;
}

/**
 * 身份注册 Hook
 */
export function useIdentityRegistration() {
  const [state, setState] = useState<IdentityRegistrationState>({
    isRegistering: false,
    isRegistered: false,
    error: null,
    commitment: null,
    merkleRoot: null,
    merkleLeaf: null,
  });

  /**
   * 注册身份
   * 
   * @param socialIdHash 社交 ID 哈希（如邮箱哈希）
   * @param level 承诺等级（1-5）
   * @param existingSecret 可选的已有 secret（用于重复注册）
   * @returns 注册结果
   */
  const register = useCallback(async (
    socialIdHash: string,
    level: number,
    existingSecret?: Uint8Array
  ): Promise<RegistrationResult | null> => {
    setState((prev) => ({ ...prev, isRegistering: true, error: null }));

    try {
      // 1. 生成或使用已有 secret
      const secret = existingSecret || generateSecret();
      
      // 2. 计算 commitment
      const socialIdHashBigInt = stringToBigInt(socialIdHash);
      const commitment = calculateCommitment(socialIdHashBigInt, secret);
      
      console.log('[Identity] 计算 Commitment:', {
        socialIdHash: socialIdHash.slice(0, 8) + '...',
        commitment: formatBigInt(commitment),
      });

      // 3. 调用后端 API 注册
      const result = await identityApi.register(formatBigInt(commitment), level);
      
      console.log('[Identity] 注册成功:', result);

      // 4. 更新状态
      setState({
        isRegistering: false,
        isRegistered: true,
        error: null,
        commitment,
        merkleRoot: result.merkleRoot,
        merkleLeaf: result.merkleLeaf,
      });

      // 5. 返回结果（包含 secret，需安全存储）
      return {
        commitment,
        secret,
        merkleRoot: result.merkleRoot,
        merkleLeaf: result.merkleLeaf,
        level,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '注册失败';
      console.error('[Identity] 注册失败:', errorMessage);
      
      setState((prev) => ({
        ...prev,
        isRegistering: false,
        error: errorMessage,
      }));
      
      return null;
    }
  }, []);

  /**
   * 清除注册状态
   */
  const reset = useCallback(() => {
    setState({
      isRegistering: false,
      isRegistered: false,
      error: null,
      commitment: null,
      merkleRoot: null,
      merkleLeaf: null,
    });
  }, []);

  return {
    ...state,
    register,
    reset,
  };
}

/**
 * 导出默认 Hook
 */
export default useIdentityRegistration;
