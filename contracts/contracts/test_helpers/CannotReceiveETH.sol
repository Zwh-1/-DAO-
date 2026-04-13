// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev 恶意合约：无法接收 ETH，用于测试 TransferFailed 错误
contract CannotReceiveETH {
    // 没有 receive() 函数，也无法通过 fallback 接收 ETH
    
    function tryTransfer(address from) external payable {
        // 尝试从 msg.sender 转账 ETH 到这个合约
        // 应该会失败，因为合约无法接收 ETH
        (bool success, ) = address(this).call{value: msg.value}("");
        require(!success, "should fail");
    }
}
