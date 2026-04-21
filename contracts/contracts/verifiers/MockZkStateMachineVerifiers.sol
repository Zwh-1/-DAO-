// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IIdentityCommitmentGroth16Verifier.sol";
import "./IAntiSybilClaimGroth16Verifier.sol";

/// @dev 本地/测试：与 identity_commitment_verifier 的 verifyProof 签名一致
/// @notice 仅限部署者可切换验证结果；链上可通过 IS_MOCK 标识检测
contract MockIdentityCommitmentGroth16Verifier is IIdentityCommitmentGroth16Verifier {
    bool public constant IS_MOCK = true;
    bool public shouldPass;
    address public immutable owner;

    event MockDeployed(address indexed deployer, bool initialShouldPass);
    event ShouldPassChanged(bool newValue);

    modifier onlyOwner() {
        require(msg.sender == owner, "MockVerifier: caller is not the owner");
        _;
    }

    constructor(bool _shouldPass) {
        owner = msg.sender;
        shouldPass = _shouldPass;
        emit MockDeployed(msg.sender, _shouldPass);
    }

    function setShouldPass(bool v) external onlyOwner {
        shouldPass = v;
        emit ShouldPassChanged(v);
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[2] calldata
    ) external view override returns (bool) {
        return shouldPass;
    }
}

/// @dev 本地/测试：与 anti_sybil_claim_verifier 的 verifyProof 签名一致
/// @notice 仅限部署者可切换验证结果；链上可通过 IS_MOCK 标识检测
contract MockAntiSybilClaimGroth16Verifier is IAntiSybilClaimGroth16Verifier {
    bool public constant IS_MOCK = true;
    bool public shouldPass;
    address public immutable owner;

    event MockDeployed(address indexed deployer, bool initialShouldPass);
    event ShouldPassChanged(bool newValue);

    modifier onlyOwner() {
        require(msg.sender == owner, "MockVerifier: caller is not the owner");
        _;
    }

    constructor(bool _shouldPass) {
        owner = msg.sender;
        shouldPass = _shouldPass;
        emit MockDeployed(msg.sender, _shouldPass);
    }

    function setShouldPass(bool v) external onlyOwner {
        shouldPass = v;
        emit ShouldPassChanged(v);
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[3] calldata
    ) external view override returns (bool) {
        return shouldPass;
    }
}
