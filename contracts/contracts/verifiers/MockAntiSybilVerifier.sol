// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAntiSybilGroth16Verifier.sol";

/// @dev 本地测试：与 `anti_sybil_verifier` 的 8 元 public 验证器 ABI 一致
/// @notice 仅限部署者可切换验证结果；链上可通过 IS_MOCK 标识检测
contract MockAntiSybilVerifier is IAntiSybilGroth16Verifier {
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
        uint256[8] calldata
    ) external view override returns (bool) {
        return shouldPass;
    }
}
