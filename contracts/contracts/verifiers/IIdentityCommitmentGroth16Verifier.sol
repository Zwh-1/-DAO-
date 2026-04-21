// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev 与 `identity_commitment.circom` 导出的 Groth16 验证器一致（2 个 public）
interface IIdentityCommitmentGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[2] calldata _pubSignals
    ) external view returns (bool);
}
