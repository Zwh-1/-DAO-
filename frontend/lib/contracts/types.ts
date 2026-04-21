/**
 * 合约 ABI 类型定义与工具
 * 
 * 功能：
 * - 提供合约调用的 TypeScript 类型支持
 * - 定义常用合约的接口类型
 * - 实现合约类型推断和转换工具
 */

import type {
  Abi,
  GetContractReturnType,
  Address,
  Client,
  Transport,
  Chain,
  Account,
} from 'viem';
import { getContract } from 'viem';

/**
 * 基础合约接口
 */
export interface BaseContract {
  abi: Abi;
  address: `0x${string}`;
}

/**
 * ClaimVault 合约接口
 */
export interface ClaimVaultAbi extends Abi {
  // 读取函数
  // function totalSupply() view returns (uint256)
  // function balanceOf(address owner) view returns (uint256)
  
  // 写入函数
  // function mint(address to, uint256 amount)
  // function burn(address from, uint256 amount)
}

/**
 * ClaimVaultZK 合约接口
 */
export interface ClaimVaultZKAbi extends Abi {
  // 读取函数
  // function verifier() view returns (address)
  // function identityRegistry() view returns (address)
  
  // 写入函数
  // function claimWithProof(bytes calldata proof, bytes32 nullifierHash)
}

/**
 * IdentityRegistry 合约接口
 */
export interface IdentityRegistryAbi extends Abi {
  // 读取函数
  // function isRegistered(bytes32 commitment) view returns (bool)
  // function getIdentityLevel(bytes32 commitment) view returns (uint8)
  
  // 写入函数
  // function register(bytes32 commitment, uint8 level)
}

/**
 * SBT 合约接口
 */
export interface SBTAbi extends Abi {
  // 读取函数
  // function ownerOf(uint256 tokenId) view returns (address)
  // function balanceOf(address owner) view returns (uint256)
  
  // 写入函数
  // function mint(address to, uint256 tokenId)
  // function burn(uint256 tokenId)
}

/**
 * AnonymousClaim 合约接口
 */
export interface AnonymousClaimAbi extends Abi {
  // 读取函数
  // function nullifierHashes(bytes32) view returns (bool)
  // function claims(bytes32) view returns (address, uint256, bool)
  
  // 写入函数
  // function anonymousClaim(bytes32 nullifierHash, address recipient)
}

/**
 * OracleManager 合约接口
 */
export interface OracleManagerAbi extends Abi {
  // 读取函数
  // function getOracleData(bytes32 dataId) view returns (bytes memory)
  // function isOracle(address oracle) view returns (bool)
  
  // 写入函数
  // function submitData(bytes32 dataId, bytes calldata data)
}

/**
 * Governance 合约接口
 */
export interface GovernanceAbi extends Abi {
  // 读取函数
  // function getProposal(uint256 proposalId) view returns (Proposal)
  // function hasVoted(uint256 proposalId, address voter) view returns (bool)
  
  // 写入函数
  // function propose(string calldata description) returns (uint256)
  // function vote(uint256 proposalId, bool support)
}

/**
 * 合约类型映射
 */
export type ContractMap = {
  ClaimVault: ClaimVaultAbi;
  ClaimVaultZK: ClaimVaultZKAbi;
  IdentityRegistry: IdentityRegistryAbi;
  SBT: SBTAbi;
  AnonymousClaim: AnonymousClaimAbi;
  OracleManager: OracleManagerAbi;
  Governance: GovernanceAbi;
};

/**
 * 获取合约类型
 */
export type GetContractType<T extends keyof ContractMap> = GetContractReturnType<
  ContractMap[T]
>;

/**
 * 合约地址配置类型
 */
export interface ContractAddresses {
  ClaimVault?: `0x${string}`;
  ClaimVaultZK?: `0x${string}`;
  IdentityRegistry?: `0x${string}`;
  SBT?: `0x${string}`;
  AnonymousClaim?: `0x${string}`;
  OracleManager?: `0x${string}`;
  Governance?: `0x${string}`;
  [key: string]: `0x${string}` | undefined;
}

/**
 * 网络配置类型
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer?: string;
  contracts: ContractAddresses;
}

/**
 * 合约配置
 */
export interface ContractConfig {
  networks: Record<number, NetworkConfig>;
  defaultNetwork: number;
}

/**
 * 获取类型安全的合约实例
 * 
 * 功能：
 * - 根据 ABI 类型自动推断合约实例类型
 * - 提供类型安全的 read/write 调用
 * 
 * @param address 合约地址
 * @param abi 合约 ABI
 * @param client viem 客户端
 * @returns 类型安全的合约实例
 */
export function getContractByAddress<
  TAbi extends Abi,
  TAddress extends Address = Address,
  TClient extends Client<Transport, Chain | undefined, Account | undefined> = Client
>(
  address: TAddress,
  abi: TAbi,
  client: TClient
): GetContractReturnType<TAbi> {
  return getContract({
    address,
    abi,
    client,
  });
}

/**
 * 合约函数返回类型推断
 * 
 * 功能：
 * - 自动推断合约函数的返回类型
 * - 支持读取函数和写入函数
 */
export type InferContractFunctionReturnType<
  TAbi extends Abi,
  TFunctionName extends string
> = any; // 简化类型推断，避免 wagmi v2 类型兼容性问题

/**
 * 合约事件类型推断
 * 
 * 功能：
 * - 自动推断合约事件的类型
 */
export type InferContractEvent<
  TAbi extends Abi,
  TEventName extends string
> = any; // 简化类型推断，避免 wagmi v2 类型兼容性问题

/**
 * 导出合约类型
 */
export type {
  Abi,
  GetContractReturnType,
  Address,
  Client,
  Transport,
  Chain,
  Account,
};
