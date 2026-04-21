/**
 * abis/index.js
 * 合约 ABI 统一导出文件
 * 
 * ⚠️  此文件由脚本自动生成，请勿手动修改！
 * 
 * 生成命令：npm run export-abis
 * 
 * 用途：
 *   - 集中管理所有合约 ABI
 *   - 便于 services 层导入使用
 *   - 支持前端共享 ABI 文件
 * 
 * 安全说明：
 *   - ABI 文件为纯数据，不包含任何逻辑
 *   - 所有 ABI 均从合约文件手动提取，确保与链上合约一致
 */

import AnonymousClaimABI from './AnonymousClaim.abi.json' with { type: 'json' };
import AntiSybilClaimZKABI from './AntiSybilClaimZK.abi.json' with { type: 'json' };
import ArbitratorPoolABI from './ArbitratorPool.abi.json' with { type: 'json' };
import ChallengeManagerABI from './ChallengeManager.abi.json' with { type: 'json' };
import ClaimVaultABI from './ClaimVault.abi.json' with { type: 'json' };
import ClaimVaultZKABI from './ClaimVaultZK.abi.json' with { type: 'json' };
import GovernanceABI from './Governance.abi.json' with { type: 'json' };
import Groth16VerifierABI from './Groth16Verifier.abi.json' with { type: 'json' };
import OracleManagerABI from './OracleManager.abi.json' with { type: 'json' };
import PaymentChannelABI from './PaymentChannel.abi.json' with { type: 'json' };
import PlatformRoleRegistryABI from './PlatformRoleRegistry.abi.json' with { type: 'json' };
import SBTABI from './SBT.abi.json' with { type: 'json' };

/**
 * 所有合约 ABI 导出对象
 * 
 * 使用示例：
 *   import { ABIS } from '@/abis/index.js';
 *   const contract = new ethers.Contract(address, ABIS.IdentityRegistry, signer);
 */
export const ABIS = {
  /**
   * AnonymousClaim 合约 ABI
   * 匿名资金申领合约：ZK 证明验证 + Nullifier 防重放
   */
  AnonymousClaim: AnonymousClaimABI,
  /**
   * AntiSybilClaimZK 合约 ABI
   * 合约 ABI
   */
  AntiSybilClaimZK: AntiSybilClaimZKABI,
  /**
   * ArbitratorPool 合约 ABI
   * 仲裁池：社区仲裁与投票
   */
  ArbitratorPool: ArbitratorPoolABI,
  /**
   * ChallengeManager 合约 ABI
   * 挑战管理器：身份挑战与仲裁
   */
  ChallengeManager: ChallengeManagerABI,
  /**
   * ClaimVault 合约 ABI
   * 传统空投申领合约（无 ZK）
   */
  ClaimVault: ClaimVaultABI,
  /**
   * ClaimVaultZK 合约 ABI
   * ZK 空投申领入口：合约层二次校验金额 + Nullifier 防重放
   */
  ClaimVaultZK: ClaimVaultZKABI,
  /**
   * Governance 合约 ABI
   * DAO 治理合约：加权投票 + 时间锁执行
   */
  Governance: GovernanceABI,
  /**
   * Groth16Verifier 合约 ABI
   * 合约 ABI
   */
  Groth16Verifier: Groth16VerifierABI,
  /**
   * OracleManager 合约 ABI
   * 预言机管理器：快速审批与风险评估
   */
  OracleManager: OracleManagerABI,
  /**
   * PaymentChannel 合约 ABI
   * 支付通道合约：高频小额支付的链下签名 + 链上结算
   */
  PaymentChannel: PaymentChannelABI,
  /**
   * PlatformRoleRegistry 合约 ABI
   * 合约 ABI
   */
  PlatformRoleRegistry: PlatformRoleRegistryABI,
  /**
   * SBT 合约 ABI
   * ERC-5192 灵魂绑定代币：不可转让的链上信用凭证
   */
  SBT: SBTABI,
};

/**
 * 单独导出每个 ABI（便于按需导入）
 */
export { AnonymousClaimABI };
export { AntiSybilClaimZKABI };
export { ArbitratorPoolABI };
export { ChallengeManagerABI };
export { ClaimVaultABI };
export { ClaimVaultZKABI };
export { GovernanceABI };
export { Groth16VerifierABI };
export { OracleManagerABI };
export { PaymentChannelABI };
export { PlatformRoleRegistryABI };
export { SBTABI };

/**
 * 获取合约 ABI 的工具函数
 * 
 * @param {string} contractName 合约名称（如 'IdentityRegistry'）
 * @returns {Array} 合约 ABI 数组
 * @throws {Error} 合约名称不存在时抛出错误
 * 
 * 使用示例：
 *   const abi = getABI('IdentityRegistry');
 *   const contract = new ethers.Contract(address, abi, signer);
 */
export function getABI(contractName) {
  const abi = ABIS[contractName];
  if (!abi) {
    throw new Error(`Unknown contract ABI: ${contractName}`);
  }
  return abi;
}
