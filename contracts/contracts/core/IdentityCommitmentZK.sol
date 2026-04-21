// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../verifiers/IIdentityCommitmentGroth16Verifier.sol";

/**
 * @title IdentityCommitmentZK
 * @notice 基于 identity_commitment.circom 的链上根状态机：验证 Groth16 后登记唯一承诺与社交域哈希占用。
 * @dev publicSignals 顺序与电路一致：[0] social_id_hash [1] identity_commitment
 *      不记录 secret/trapdoor；事件仅索引 commitment 以降低链上关联面。
 */
contract IdentityCommitmentZK {
    IIdentityCommitmentGroth16Verifier public immutable verifier;

    mapping(uint256 => bool) public commitmentRegistered;
    mapping(uint256 => bool) public socialIdHashUsed;

    event IdentityRootRegistered(uint256 indexed identityCommitment, uint256 timestamp);

    error InvalidProof();
    error CommitmentAlreadyRegistered();
    error SocialIdHashAlreadyUsed();

    constructor(address verifier_) {
        verifier = IIdentityCommitmentGroth16Verifier(verifier_);
    }

    /**
     * @notice 提交证明并注册身份承诺根（permissionless）
     */
    function registerWithProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[2] calldata pubSignals
    ) external {
        if (!verifier.verifyProof(pA, pB, pC, pubSignals)) revert InvalidProof();

        uint256 social = pubSignals[0];
        uint256 commitment = pubSignals[1];

        if (commitmentRegistered[commitment]) revert CommitmentAlreadyRegistered();
        if (socialIdHashUsed[social]) revert SocialIdHashAlreadyUsed();

        commitmentRegistered[commitment] = true;
        socialIdHashUsed[social] = true;

        emit IdentityRootRegistered(commitment, block.timestamp);
    }

    function isCommitmentRootRegistered(uint256 commitment) external view returns (bool) {
        return commitmentRegistered[commitment];
    }

    function isSocialIdHashUsed(uint256 socialIdHash) external view returns (bool) {
        return socialIdHashUsed[socialIdHash];
    }
}
