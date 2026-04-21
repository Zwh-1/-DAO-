/**
 * 合约 ABI 统一导入
 * 
 * 来源：
 * - 从后端 `backend/src/abis/` 同步
 * - 或从 `contracts/artifacts/` 导出
 * 
 * 注意：
 * - ABI 必须与链上部署的合约一致
 * - 定期同步后端 ABI 文件
 */

/**
 * ClaimVault 合约 ABI
 * 
 * 功能：
 * - 空投申领
 * - Nullifier 验证
 */
export const claimVaultAbi = [
  "function claimAirdrop(uint256[2] calldata a,uint256[2][2] calldata b,uint256[2] calldata c,uint256[] calldata pubSignals) external",
  "function usedNullifiers(bytes32) external view returns (bool)"
] as const;

/**
 * IdentityRegistry 合约 ABI
 * 
 * 功能：
 * - 身份注册
 * - SBT 铸造
 */
export const identityRegistryAbi = [
  "function registerIdentityCommitment(uint256 commitment) external",
  "function mintSBT(address recipient, uint256 commitment) external",
  "function getSBTInfo(uint256 sbtId) external view returns (tuple(address owner, uint256 credit))",
  "function updateSBTCredit(uint256 sbtId, uint256 newCredit) external"
] as const;

/**
 * Groth16Verifier 合约 ABI
 * 
 * 功能：
 * - zk 证明验证
 */
export const groth16VerifierAbi = [
  "function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[] calldata _pubSignals) public view returns (bool)"
] as const;

/**
 * PaymentChannel 合约 ABI
 * 
 * 功能：
 * - 支付通道管理
 * - 挑战与结算
 */
export const paymentChannelAbi = [
  "function createChannel(address counterparty, uint256 timeout) external payable",
  "function closeChannel(bytes32 balanceProof) external",
  "function challengeChannel(bytes32 balanceProof) external",
  "function withdraw() external"
] as const;

/**
 * Governance 合约 ABI
 * 
 * 功能：
 * - 提案创建
 * - 投票
 * - 执行
 */
export const governanceAbi = [
  "function createProposal(string calldata description, uint256 votingPeriod) external returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support) external",
  "function executeProposal(uint256 proposalId) external",
  "function getProposal(uint256 proposalId) external view returns (tuple(uint256 id, address proposer, uint256 forVotes, uint256 againstVotes, bool executed))"
] as const;

/**
 * 所有合约 ABI 映射
 */
export const CONTRACT_ABIS = {
  ClaimVault: claimVaultAbi,
  IdentityRegistry: identityRegistryAbi,
  Groth16Verifier: groth16VerifierAbi,
  PaymentChannel: paymentChannelAbi,
  Governance: governanceAbi,
} as const;

/**
 * 合约名称类型
 */
export type ContractName = keyof typeof CONTRACT_ABIS;

/**
 * 获取合约 ABI
 * 
 * @param name 合约名称
 * @returns 合约 ABI 数组
 */
export function getContractABI(name: ContractName): readonly string[] {
  return CONTRACT_ABIS[name];
}
