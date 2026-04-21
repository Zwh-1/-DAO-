/** ClaimVaultZK 最小 ABI（中继 / 只读） */
export const claimVaultAbi = [
  "function claimAirdrop(uint256[2] calldata a,uint256[2][2] calldata b,uint256[2] calldata c,uint256[] calldata pubSignals,bytes calldata signature) external",
  "function usedNullifiers(uint256) external view returns (bool)",
  "function expectedMerkleRoot() external view returns (uint256)",
  "function expectedParameterHash() external view returns (uint256)",
  "function airdropProjectId() external view returns (uint256)",
];
