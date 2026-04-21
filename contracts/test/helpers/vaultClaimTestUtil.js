/**
 * ClaimVaultZK + anti_sybil_verifier（8 public）测试辅助
 */

const VAULT_TEST_MERKLE_ROOT = 0n;
const VAULT_TEST_PARAMETER_HASH = 0n;
const VAULT_TEST_PROJECT_ID = 1n;

/**
 * 构造 8 元 publicSignals（与 anti_sybil_verifier.circom 一致）
 */
function buildAntiSybilPubSignals({
  nullifier,
  commitment,
  claimAmount,
  userLevel = 10n,
  merkleLeaf = 999n,
  merkleRoot = VAULT_TEST_MERKLE_ROOT,
  parameterHash = VAULT_TEST_PARAMETER_HASH,
  ts = BigInt(Math.floor(Date.now() / 1000)),
}) {
  return [
    merkleRoot,
    commitment,
    nullifier,
    userLevel,
    claimAmount,
    ts,
    parameterHash,
    merkleLeaf,
  ];
}

/**
 * EIP-712 Claim 签名（与 ClaimVaultZK.CLAIM_TYPEHASH 一致）
 */
async function signVaultClaimTypedData(signer, vaultAddress, chainId, nullifier, identityCommitment, projectId) {
  const domain = {
    name: "ClaimVaultZK",
    version: "1",
    chainId,
    verifyingContract: vaultAddress,
  };
  const types = {
    Claim: [
      { name: "nullifier", type: "uint256" },
      { name: "identityCommitment", type: "uint256" },
      { name: "projectId", type: "uint256" },
    ],
  };
  const value = {
    nullifier,
    identityCommitment,
    projectId,
  };
  return signer.signTypedData(domain, types, value);
}

module.exports = {
  VAULT_TEST_MERKLE_ROOT,
  VAULT_TEST_PARAMETER_HASH,
  VAULT_TEST_PROJECT_ID,
  buildAntiSybilPubSignals,
  signVaultClaimTypedData,
};
