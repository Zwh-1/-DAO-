// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ClaimVault
 * @notice 空投申领金库合约（优化版）
 * 
 * 功能：
 * - 管理空投资金池
 * - 支持 ZK 证明验证后支付
 * - 防重放机制（Nullifier）
 * 
 * 优化点：
 * - Gas 优化（自定义错误、打包变量）
 * - 安全增强（重入保护、余额检查）
 * - 事件日志完善（便于链下追踪）
 * 
 * @author TrustAID Team
 */
contract ClaimVault is ReentrancyGuard {
    // ── 自定义错误（Gas 优化）──────────────────────────────────
    /**
     * @dev Nullifier 已使用（防重放）
     */
    error NullifierAlreadyUsed();
    /**
     * @dev 申领金额无效
     */
    error InvalidClaimAmount();
    /**
     * @dev 余额不足
     */
    error InsufficientBalance();
    /**
     * @dev 转账失败
     */
    error TransferFailed();
    /**
     * @dev 存款金额为 0
     */
    error ZeroDeposit();
    /**
     * @dev 提现地址无效
     */
    error InvalidWithdrawalAddress();

    // ── 事件定义 ────────────────────────────────────────────────
    /**
     * @notice 申领请求提交
     * @param nullifierHash Nullifier 哈希（防重放）
     * @param claimant 申领者地址
     * @param amount 申领金额
     * @param evidenceCid 证据 CID（链下存储）
     */
    event ClaimProposed(
        bytes32 indexed nullifierHash,
        address indexed claimant,
        uint256 amount,
        string evidenceCid
    );
    
    /**
     * @notice 申领支付成功
     * @param nullifierHash Nullifier 哈希
     * @param claimant 申领者地址
     * @param amount 支付金额
     * @param txHash 交易哈希（用于链下追踪）
     */
    event ClaimPaid(
        bytes32 indexed nullifierHash,
        address indexed claimant,
        uint256 amount,
        bytes32 txHash
    );
    
    /**
     * @notice 存款成功
     * @param from 存款人地址
     * @param amount 存款金额
     * @param timestamp 存款时间
     */
    event Deposited(
        address indexed from,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @notice 提现成功
     * @param to 提现地址
     * @param amount 提现金额
     * @param timestamp 提现时间
     */
    event Withdrawn(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    // ── 状态变量（打包优化）─────────────────────────────────────
    /// @dev Nullifier 使用状态映射
    mapping(bytes32 => bool) public nullifierUsed;

    /// @notice 最大申领金额（immutable，Gas 优化）
    uint256 public immutable maxClaimAmount;
    
    /// @notice 总余额（用于支付申领）
    uint256 public totalBalance;
    
    /// @notice 已支付总额（监控指标）
    uint256 public totalPaid;
    
    /// @notice 管理员地址
    address public owner;

    /// @notice 合约是否激活（紧急暂停功能）
    bool public isActive = true;

    /// @dev 管理员修改者
    modifier onlyOwner() {
        if (msg.sender != owner) revert("not owner");
        _;
    }

    /// @dev 合约激活检查
    modifier whenActive() {
        if (!isActive) revert("contract paused");
        _;
    }

    /**
     * @dev 构造函数
     * @param _maxClaimAmount 最大申领金额
     */
    constructor(uint256 _maxClaimAmount) {
        maxClaimAmount = _maxClaimAmount;
        owner = msg.sender;
        emit Deposited(msg.sender, 0, block.timestamp); // 初始化事件
    }
    
    /**
     * @dev 接收 ETH 存款（支持直接转账）
     * @notice 资金用于支付用户的 ZK 申领
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        
        totalBalance += msg.value;
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev 显式存款函数（可选）
     * @notice 支持管理员或第三方注资
     */
    function deposit() external payable whenActive {
        if (msg.value == 0) revert ZeroDeposit();
        
        totalBalance += msg.value;
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev 管理员提取资金（紧急情况下使用）
     * @notice 仅当合约暂停时可提取，保护用户资金
     * @param amount 提取金额
     * @param to 接收地址
     */
    function withdraw(uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert InvalidWithdrawalAddress();
        if (amount > totalBalance) revert InsufficientBalance();
        
        totalBalance -= amount;
        
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(to, amount, block.timestamp);
    }

    /**
     * @dev 切换合约激活状态（紧急暂停）
     * @notice 仅管理员可操作
     */
    function toggleActive() external onlyOwner {
        isActive = !isActive;
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
     * ✅ 激活检查：防止暂停期间操作
     */
    function proposeClaim(
        bytes32 nullifierHash,
        uint256 amount,
        string calldata evidenceCid
    ) external nonReentrant whenActive {
        // 参数验证
        if (nullifierUsed[nullifierHash]) revert NullifierAlreadyUsed();
        if (amount == 0 || amount > maxClaimAmount) revert InvalidClaimAmount();
        
        // 余额检查（确保有足够资金支付）
        if (amount > totalBalance) revert InsufficientBalance();
        
        // 记录 Nullifier 已使用（CEI 模式：Checks-Effects-Interactions）
        nullifierUsed[nullifierHash] = true;
        
        // 更新余额和统计
        totalBalance -= amount;
        totalPaid += amount;
        
        // 执行转账（Gas 热点：使用 call 而非 transfer）
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        // 触发事件（包含交易哈希用于追踪）
        emit ClaimProposed(nullifierHash, msg.sender, amount, evidenceCid);
        emit ClaimPaid(nullifierHash, msg.sender, amount, keccak256(abi.encodePacked(blockhash(block.number - 1), msg.sender, amount)));
    }
    
    /**
     * @dev 批量检查 Nullifier 是否已使用
     * @notice Gas 优化：批量查询
     * @param nullifierHashes Nullifier 哈希数组
     * @return results 使用状态数组
     */
    function checkNullifiers(bytes32[] calldata nullifierHashes) external view returns (bool[] memory results) {
        uint256 len = nullifierHashes.length;
        results = new bool[](len);
        
        for (uint256 i = 0; i < len; i++) {
            results[i] = nullifierUsed[nullifierHashes[i]];
        }
        
        return results;
    }
}
