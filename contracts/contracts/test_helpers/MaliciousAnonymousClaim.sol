// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAnonymousClaim {
    function claim(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata pubSignals
    ) external;
}

/// @dev 恶意合约：尝试在 AnonymousClaim 中重入
contract MaliciousAnonymousClaim {
    IAnonymousClaim public claimContract;
    
    constructor(address claimAddress) {
        claimContract = IAnonymousClaim(claimAddress);
    }
    
    function attack() external payable {
        uint256[2] memory a = [uint256(0), 0];
        uint256[2][2] memory b;
        b[0] = [uint256(0), 0];
        b[1] = [uint256(0), 0];
        uint256[2] memory c = [uint256(0), 0];
        uint256[] memory pubSignals = new uint256[](11);
        
        try claimContract.claim(a, b, c, pubSignals) {
            claimContract.claim(a, b, c, pubSignals);
        } catch {
            // 预期会失败
        }
    }
    
    receive() external payable {
        uint256[2] memory a = [uint256(0), 0];
        uint256[2][2] memory b;
        b[0] = [uint256(0), 0];
        b[1] = [uint256(0), 0];
        uint256[2] memory c = [uint256(0), 0];
        uint256[] memory pubSignals = new uint256[](11);
        
        try claimContract.claim(a, b, c, pubSignals) {
            // 应该被重入防护阻止
        } catch {
            // 预期会失败
        }
    }
}
