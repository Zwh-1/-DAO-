// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/core/ClaimVaultZK.sol";

/// @dev 恶意合约：尝试在 claimAirdrop 中重入
/// @notice 用于测试 ClaimVaultZK 的 ReentrancyGuard 防护
contract MaliciousClaim {
    ClaimVaultZK public vault;
    uint256 public constant TEST_AMOUNT = 1000;
    
    constructor(address vaultAddress) {
        vault = ClaimVaultZK(payable(vaultAddress));
    }
    
    /// @dev 尝试重入攻击
    /// @notice 在 receive 函数中再次调用 claimAirdrop
    function attack() external payable {
        // 构造假的证明数据
        uint256[2] memory a = [uint256(0), 0];
        uint256[2][2] memory b;
        b[0] = [uint256(0), 0];
        b[1] = [uint256(0), 0];
        uint256[2] memory c = [uint256(0), 0];
        
        // 构造 public signals（8 个，与 anti_sybil_verifier.circom 一致）
        uint256[] memory pubSignals = new uint256[](8);
        pubSignals[0] = 0; // merkle_root（须与 vault.expectedMerkleRoot 一致）
        pubSignals[1] = 12345; // identity_commitment
        pubSignals[2] = uint256(keccak256(abi.encodePacked("malicious"))); // nullifier
        pubSignals[3] = 10; // user_level
        pubSignals[4] = TEST_AMOUNT; // claim_amount
        pubSignals[5] = uint256(block.timestamp); // claim_ts
        pubSignals[6] = 0; // parameter_hash（须与 vault.expectedParameterHash 一致）
        pubSignals[7] = 999; // merkle_leaf
        
        // 第一次调用（会失败，因为证明无效，但这足以测试重入防护）
        try vault.claimAirdrop(a, b, c, pubSignals, "") {
            // 如果成功，尝试重入
            vault.claimAirdrop(a, b, c, pubSignals, "");
        } catch {
            // 预期会失败（证明无效或重入防护）
        }
    }
    
    /// @dev 接收 ETH（用于重入）
    receive() external payable {
        // 尝试在接收 ETH 时再次调用 claimAirdrop
        uint256[2] memory a = [uint256(0), 0];
        uint256[2][2] memory b;
        b[0] = [uint256(0), 0];
        b[1] = [uint256(0), 0];
        uint256[2] memory c = [uint256(0), 0];
        
        uint256[] memory pubSignals = new uint256[](8);
        pubSignals[0] = 0;
        pubSignals[1] = 12345;
        pubSignals[2] = uint256(keccak256(abi.encodePacked("malicious2")));
        pubSignals[3] = 10;
        pubSignals[4] = TEST_AMOUNT;
        pubSignals[5] = uint256(block.timestamp);
        pubSignals[6] = 0;
        pubSignals[7] = 999;
        
        // 尝试重入（应该被 ReentrancyGuard 阻止）
        vault.claimAirdrop(a, b, c, pubSignals, "");
    }
}
