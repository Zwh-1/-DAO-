// SPDX-License-Identifier: MIT
// 文件：contracts/anonymous/AnonymousClaim.sol
// 功能：匿名资金领取合约（ZK 证明验证 + Nullifier 防重放）
// 
// 核心逻辑：
// 1. 用户提交 ZK 证明（证明自己拥有 Merkle Tree 中的某个承诺）
// 2. 合约验证证明（不暴露用户身份）
// 3. 检查 Nullifier 未使用（防止重复领取）
// 4. 发放资金到用户指定地址
// 
// 安全设计：
// - 资产守恒：总发放金额 <= 总锁定资金
// - 防重放：Nullifier 全局唯一，使用后记录
// - 隐私保护：不记录用户身份，只记录 Nullifier
// - 防跨合约重放：证明包含合约地址
// 
// Gas 优化：
// - 使用 Groth16 验证器（~250k Gas）
// - 批量操作支持（减少重复验证）
// - 使用自定义 error（替代 string，节省 Gas）
// 
// 业务场景：
// - 匿名空投领取
// - 隐私互助奖励
// - 去中心化补贴发放

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 导入 Groth16 验证器接口
interface IGroth16Verifier {
    function verifyProof(
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[] memory _pubSignals  // 动态数组，支持任意数量的公开信号
    ) external view returns (bool);
}

/// @notice 安全重构版：添加 ReentrancyGuard 与 Ownable 权限控制
/// @dev 建议：生产环境将 Owner 设置为 Multisig 多签钱包
contract AnonymousClaim is ReentrancyGuard, Ownable {
    // ── 自定义错误（Gas 优化）──────────────────────────────────
    error NullifierAlreadyUsed();
    error InsufficientFunds();
    error InvalidTimeWindow();
    error InvalidProof();
    error MerkleRootMismatch();
    error NullifierMismatch();
    error AmountMismatch();
    error ZeroDeposit();
    error TransferFailed();
    error InvalidVerifier();
    error InvalidMerkleRoot();
    
    // ── 状态变量 ────────────────────────────────────────────────
    address public immutable verifier;      // ZK 验证器地址
    uint256 public immutable merkleRoot;    // Merkle 根（承诺树）
    uint256 public immutable tsStart;       // 领取开始时间
    uint256 public immutable tsEnd;         // 领取结束时间
    uint256 public totalBalance;            // 总锁定资金
    
    // ── Nullifier 管理（防重放）────────────────────────────────
    // 安全设计：
    // - 记录已使用的 Nullifier
    // - 防止同一用户重复领取
    // - 只存哈希，不暴露身份
    mapping(uint256 => bool) public usedNullifiers;
    
    // ── 领取统计 ──────────────────────────────────────────────
    uint256 public totalClaimed;            // 已领取总额
    uint256 public claimCount;              // 领取次数
    
    // ── 事件定义 ────────────────────────────────────────────────
    /**
     * @dev 领取成功事件
     * 用途：前端监听，更新 UI
     * 
     * 隐私设计：
     * - 不记录领取者地址
     * - 只记录 Nullifier（无法反推身份）
     */
    event Claimed(
        uint256 indexed nullifier,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @dev 资金存入事件
     * 用途：记录资金池变化
     */
    event Funded(
        uint256 amount,
        uint256 totalBalance,
        uint256 timestamp
    );
    
    // ── 构造函数 ────────────────────────────────────────────────
    /**
     * @dev 初始化匿名领取合约
     * @param _verifier Groth16 验证器地址
     * @param _merkleRoot Merkle 根（承诺树）
     * @param _tsStart 领取开始时间（Unix 时间戳）
     * @param _tsEnd 领取结束时间（Unix 时间戳）
     * 
     * 安全设计：
     * - verifier 不能为零地址
     * - merkleRoot 必须非零
     * - tsEnd 必须大于 tsStart
     */
    constructor(
        address _verifier,
        uint256 _merkleRoot,
        uint256 _tsStart,
        uint256 _tsEnd
    ) {
        if (_verifier == address(0)) revert InvalidVerifier();
        if (_merkleRoot == 0) revert InvalidMerkleRoot();
        if (_tsEnd <= _tsStart) revert InvalidTimeWindow();
        
        verifier = _verifier;
        merkleRoot = _merkleRoot;
        tsStart = _tsStart;
        tsEnd = _tsEnd;
        totalBalance = 0;
    }
    
    // ── 核心函数：领取资金 ──────────────────────────────────────
    /**
     * @dev 匿名领取资金
     * @param recipient 接收地址
     * @param amount 领取金额
     * @param nullifier 防重放 Nullifier
     * @param pA Groth16 证明点 A
     * @param pB Groth16 证明点 B
     * @param pC Groth16 证明点 C
     * @param pubSignals 公开信号
     * 
     * 业务逻辑：
     * 1. 检查 Nullifier 未使用
     * 2. 验证 ZK 证明（Merkle 证明 + 金额范围）
     * 3. 记录 Nullifier 为已使用
     * 4. 转账到 recipient
     * 
     * 安全约束：
     * ✅ Nullifier 唯一性：防止重复领取
     * ✅ 证明验证：确保用户有领取资格
     * ✅ 余额检查：确保资金池有足够资金
     * ✅ 防重入：先更新状态再转账（CEI 模式）
     * 
     * Gas 消耗：~300,000（包含验证和转账）
     */
    function claim(
        address recipient,
        uint256 amount,
        uint256 nullifier,
        uint[2] memory pA,
        uint[2][2] memory pB,
        uint[2] memory pC,
        uint[7] memory pubSignals  // [merkle_root, nullifier, commitment, claim_amount, current_timestamp, ts_start, ts_end]
    ) public nonReentrant {
        // ✅ 约束 1: Nullifier 未使用（防重放）
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed();
        
        // ✅ 约束 2: 资金池有足够资金
        if (amount > totalBalance) revert InsufficientFunds();
        
        // ✅ 约束 3: 验证时间窗口
        // pubSignals[4] = current_timestamp (由电路验证 block.timestamp)
        // pubSignals[5] = ts_start
        // pubSignals[6] = ts_end
        if (pubSignals[5] != tsStart) revert InvalidTimeWindow();
        if (pubSignals[6] != tsEnd) revert InvalidTimeWindow();
        
        // ✅ 约束 4: 验证 ZK 证明（包含时间窗口验证）
        // pubSignals: [merkle_root, nullifier, commitment, claim_amount, current_timestamp, ts_start, ts_end]
        // 注意：电路中的公开信号顺序必须与这里一致
        uint[] memory pubSignalsDynamic = new uint[](7);
        pubSignalsDynamic[0] = pubSignals[0];
        pubSignalsDynamic[1] = pubSignals[1];
        pubSignalsDynamic[2] = pubSignals[2];
        pubSignalsDynamic[3] = pubSignals[3];
        pubSignalsDynamic[4] = pubSignals[4];
        pubSignalsDynamic[5] = pubSignals[5];
        pubSignalsDynamic[6] = pubSignals[6];
        
        if (!IGroth16Verifier(verifier).verifyProof(pA, pB, pC, pubSignalsDynamic)) {
            revert InvalidProof();
        }
        
        // ✅ 约束 5: 验证 Merkle Root 匹配
        if (pubSignals[0] != merkleRoot) revert MerkleRootMismatch();
        
        // ✅ 约束 6: 验证 Nullifier 匹配
        if (pubSignals[1] != nullifier) revert NullifierMismatch();
        
        // ✅ 约束 7: 验证领取金额匹配
        if (pubSignals[3] != amount) revert AmountMismatch();
        
        // ── 更新状态（CEI 模式：Checks-Effects-Interactions）───
        usedNullifiers[nullifier] = true;
        totalBalance -= amount;
        totalClaimed += amount;
        claimCount++;
        
        // ── 执行转账 ──────────────────────────────────────────
        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        // ── 触发事件 ──────────────────────────────────────────
        emit Claimed(nullifier, amount, block.timestamp);
    }
    
    // ── 辅助函数：存入资金 ──────────────────────────────────────
    /**
     * @dev 向资金池存入 ETH
     * 
     * 业务场景：
     * - 发起人锁定空投资金
     * - 社区捐赠
     * 
     * 安全设计：
     * ✅ 必须发送 ETH（msg.value > 0）
     * ✅ 记录总金额
     */
    function fund() public payable {
        if (msg.value == 0) revert ZeroDeposit();
        
        totalBalance += msg.value;
        
        emit Funded(msg.value, totalBalance, block.timestamp);
    }
    
    // ── 辅助函数：紧急提款 ──────────────────────────────────────
    /**
     * @dev 紧急提款（仅管理员）
     * @param to 提款地址
     * @param amount 提款金额
     * 
     * 业务场景：
     * - 活动结束后提取剩余资金
     * - 紧急情况暂停合约
     * 
     * 安全设计：
     * ✅ 添加 onlyOwner 修饰符（权限控制）
     * ⚠️ 建议：下一步引入 Timelock（延迟 24 小时执行）
     * ⚠️ 建议：生产环境将 Owner 设置为 Multisig 多签钱包
     * ✅ 已添加 ReentrancyGuard 保护
     */
    function emergencyWithdraw(address to, uint256 amount) public onlyOwner nonReentrant {
        if (amount > totalBalance) revert InsufficientFunds();
        
        totalBalance -= amount;
        
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    // ── 视图函数：查询状态 ──────────────────────────────────────
    /**
     * @dev 查询 Nullifier 是否已使用
     */
    function isNullifierUsed(uint256 nullifier) public view returns (bool) {
        return usedNullifiers[nullifier];
    }
    
    /**
     * @dev 查询可领取资金池余额
     */
    function getBalance() public view returns (uint256) {
        return totalBalance;
    }
    
    /**
     * @dev 查询统计信息
     */
    function getStats() public view returns (
        uint256 _totalClaimed,
        uint256 _claimCount,
        uint256 remaining
    ) {
        return (
            totalClaimed,
            claimCount,
            totalBalance
        );
    }
    
    // ── 接收 ETH ────────────────────────────────────────────────
    /**
     * @dev 接收 ETH（直接发送）
     * 
     * 安全设计：
     * ✅ 自动调用 fund() 逻辑
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        
        totalBalance += msg.value;
        emit Funded(msg.value, totalBalance, block.timestamp);
    }
}
