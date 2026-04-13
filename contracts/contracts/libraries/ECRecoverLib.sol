// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice ECRecover 库：从签名中恢复地址
/// @dev 封装 EVM 预编译合约调用（地址 0x01）
/// @notice Gas 优化：库函数默认内联，无额外调用开销
library ECRecoverLib {
    /// @dev 从签名中恢复签名者地址
    /// @param hash 已哈希的消息
    /// @param v 签名 v 值（27 或 28）
    /// @param r 签名 r 值
    /// @param s 签名 s 值
    /// @return signer 签名者地址
    function ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal view returns (address) {
        assembly {
            // 准备参数（内存布局）
            mstore(0x00, hash)
            mstore(0x20, v)
            mstore(0x40, r)
            mstore(0x60, s)
            
            // 调用预编译合约（地址 0x01）
            let result := staticcall(3000, 1, 0x00, 0x80, 0x00, 0x20)
            
            // 失败则 revert
            if iszero(result) {
                revert(0x00, 0x00)
            }
            
            // 返回结果（地址）
            return(0x00, 0x20)
        }
    }
}
