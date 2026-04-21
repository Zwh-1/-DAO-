// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

/// @dev 与 `anti_sybil_verifier.circom` 导出的 Groth16 验证器 ABI 对齐（8 个 public 输入）
interface IAntiSybilGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[8] calldata _pubSignals
    ) external view returns (bool);
}
