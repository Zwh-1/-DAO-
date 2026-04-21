// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../verifiers/IAntiSybilClaimGroth16Verifier.sol";

/**
 * @title AntiSybilClaimZK
 * @notice 基于 anti_sybil_claim.circom 的链上申领状态机：验证后消费 Nullifier（防重放）。
 * @dev publicSignals 顺序：[0] expectedNullifierHash [1] claimAmount [2] maxClaimAmount
 *      电路已约束 claimAmount < maxClaimAmount 且 claimAmount >= 1；本合约仅做证明校验与 nullifier 记账。
 */
contract AntiSybilClaimZK {
    IAntiSybilClaimGroth16Verifier public immutable verifier;

    mapping(uint256 => bool) public nullifierSpent;

    event ClaimNullifierSpent(uint256 indexed nullifierHash, uint256 claimAmount, uint256 maxClaimAmount, uint256 timestamp);

    error InvalidProof();
    error NullifierAlreadySpent();

    constructor(address verifier_) {
        verifier = IAntiSybilClaimGroth16Verifier(verifier_);
    }

    /**
     * @notice 校验证明并标记 nullifier 已使用（permissionless）
     */
    function spendWithProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[3] calldata pubSignals
    ) external {
        if (!verifier.verifyProof(pA, pB, pC, pubSignals)) revert InvalidProof();

        uint256 nullifierHash = pubSignals[0];
        uint256 claimAmount = pubSignals[1];
        uint256 maxClaimAmount = pubSignals[2];

        if (nullifierSpent[nullifierHash]) revert NullifierAlreadySpent();

        nullifierSpent[nullifierHash] = true;

        emit ClaimNullifierSpent(nullifierHash, claimAmount, maxClaimAmount, block.timestamp);
    }

    function isNullifierSpent(uint256 nullifierHash) external view returns (bool) {
        return nullifierSpent[nullifierHash];
    }
}
