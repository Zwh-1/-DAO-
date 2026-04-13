// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/core/ClaimVaultZK.sol";

/// @dev 恶意合约：尝试在紧急提款中重入
/// @notice 用于测试 ClaimVaultZK 的 ReentrancyGuard 防护
contract MaliciousWithdraw {
    ClaimVaultZK public vault;
    
    constructor(address vaultAddress) {
        vault = ClaimVaultZK(payable(vaultAddress));
    }
    
    /// @dev 尝试重入攻击
    function attack() external payable {
        // 先暂停合约
        vault.setPaused(true);
        
        // 第一次提款
        try vault.withdraw(1000, address(this)) {
            // 如果成功，尝试重入
            vault.withdraw(1000, address(this));
        } catch {
            // 预期会失败
        }
    }
    
    /// @dev 接收 ETH（用于重入）
    receive() external payable {
        // 尝试在接收 ETH 时再次提款
        try vault.withdraw(1000, address(this)) {
            // 应该被重入防护阻止
        } catch {
            // 预期会失败
        }
    }
}
