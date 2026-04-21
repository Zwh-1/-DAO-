// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev 与 `anti_sybil_claim.circom` 导出的 Groth16 验证器一致（3 个 public）
interface IAntiSybilClaimGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external view returns (bool);
}
