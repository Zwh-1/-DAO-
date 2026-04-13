// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IGroth16Verifier.sol";

/// @dev 本地/测试网占位：生产环境替换为 snarkjs 导出的 Groth16Verifier.sol
contract MockGroth16Verifier is IGroth16Verifier {
    bool public shouldPass;

    constructor(bool _shouldPass) {
        shouldPass = _shouldPass;
    }

    function setShouldPass(bool v) external {
        shouldPass = v;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[] calldata
    ) external view override returns (bool) {
        return shouldPass;
    }
}
