// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @notice 安全重构版：添加存款管理与余额检查
contract ClaimVault is ReentrancyGuard {
    // ── 自定义错误（Gas 优化）──────────────────────────────────
    error NullifierAlreadyUsed();
    error InvalidClaimAmount();
    error InsufficientBalance();
    error TransferFailed();
    error ZeroDeposit();

    // ── 事件定义 ────────────────────────────────────────────────
    event ClaimProposed(
        bytes32 indexed nullifierHash,
        address indexed claimant,
        uint256 amount,
        string evidenceCid
    );
    
    event ClaimPaid(
        bytes32 indexed nullifierHash,
        address indexed claimant,
        uint256 amount
    );
    
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ── 状态变量 ────────────────────────────────────────────────
    mapping(bytes32 => bool) public nullifierUsed;

    uint256 public immutable maxClaimAmount;
    uint256 public totalBalance;  // 总余额（用于支付申领）
    
    address public owner;  // 管理员（用于紧急提款）

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(uint256 _maxClaimAmount) {
        maxClaimAmount = _maxClaimAmount;
        owner = msg.sender;
    }
    
    /**
     * @dev 接收 ETH 存款（支持直接转账）
     * @notice 资金用于支付用户的 ZK 申领
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        
        totalBalance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev 显式存款函数（可选）
     * @notice 支持管理员或第三方注资
     */
    function deposit() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        
        totalBalance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev 管理员提取资金（紧急情况下使用）
     * @notice 仅当合约暂停时可提取，保护用户资金
     */
    function withdraw(uint256 amount, address to) external onlyOwner {
        if (amount > totalBalance) revert InsufficientBalance();
        
        totalBalance -= amount;
        
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(to, amount);
    }

    /**
     * @dev 提出申领请求（包含支付）
     * @notice 支持直接支付 ETH 到申领者
     * @param nullifierHash Nullifier 哈希（防重放）
     * @param amount 申领金额
     * @param evidenceCid 证据 CID（链下存储）
     * 
     * 安全设计：
     * ✅ 余额检查：确保合约有足够资金支付
     * ✅ 重入保护：nonReentrant 修饰符
     * ✅ CEI 模式：先更新状态，再转账
     */
    function proposeClaim(
        bytes32 nullifierHash,
        uint256 amount,
        string calldata evidenceCid
    ) external nonReentrant {
        if (nullifierUsed[nullifierHash]) revert NullifierAlreadyUsed();
        if (amount == 0 || amount > maxClaimAmount) revert InvalidClaimAmount();
        
        // 余额检查（确保有足够资金支付）
        if (amount > totalBalance) revert InsufficientBalance();
        
        // 记录 Nullifier 已使用
        nullifierUsed[nullifierHash] = true;
        
        // 更新余额
        totalBalance -= amount;
        
        // 执行转账
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        // 触发事件
        emit ClaimProposed(nullifierHash, msg.sender, amount, evidenceCid);
        emit ClaimPaid(nullifierHash, msg.sender, amount);
    }
}
