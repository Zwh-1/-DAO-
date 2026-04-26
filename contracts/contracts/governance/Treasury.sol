// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @notice 平台国库合约
/// @dev    接收来自 ChallengeManager slash、OracleManager slash 等模块的资金。
///         Guardian（owner）可提案通过 Governance 时间锁后转移资金。
///         支持 /v1/governance/treasury 和 /v1/audit/flow 前端页面。
contract Treasury is ReentrancyGuard {
    // ── 自定义错误 ─────────────────────────────────────────────────────────

    error OnlyOwner();
    error OnlyGovernance();
    error TransferFailed();
    error ZeroAmount();
    error ZeroAddress();
    error InvalidCategory();

    // ── 收支类型枚举 ────────────────────────────────────────────────────────

    enum FlowType {
        Deposit,       // 收入（slash、质押利息等）
        Withdrawal,    // 支出（DAO 提案执行）
        ClaimPayout,   // 理赔付款
        Reward         // 奖励发放
    }

    // ── 事件 ───────────────────────────────────────────────────────────────

    event Received(address indexed from, uint256 amount, FlowType flowType, string note);
    event Withdrawn(address indexed to, uint256 amount, string note, bytes32 indexed proposalRef);
    event GovernanceSet(address indexed governance);

    // ── 状态 ───────────────────────────────────────────────────────────────

    address public owner;
    address public governance;  // Governance 合约地址（时间锁执行方）

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner) revert OnlyGovernance();
        _;
    }

    // ── 配置 ───────────────────────────────────────────────────────────────

    /// @notice 设置 Governance 合约地址（仅 owner）
    function setGovernance(address _governance) external onlyOwner {
        if (_governance == address(0)) revert ZeroAddress();
        governance = _governance;
        emit GovernanceSet(_governance);
    }

    // ── 收款 ───────────────────────────────────────────────────────────────

    /// @notice 任意地址可向国库存款（如 slash 惩罚金）
    /// @param flowType 收款类型（0-3）
    /// @param note     附注（链上事件记录）
    function deposit(uint8 flowType, string calldata note) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (flowType > uint8(type(FlowType).max)) revert InvalidCategory();

        totalDeposited += msg.value;
        emit Received(msg.sender, msg.value, FlowType(flowType), note);
    }

    /// @dev 接收普通 ETH 转账（如 ChallengeManager slash 直转）
    receive() external payable {
        if (msg.value > 0) {
            totalDeposited += msg.value;
            emit Received(msg.sender, msg.value, FlowType.Deposit, "direct transfer");
        }
    }

    // ── 支出（需 Governance 提案通过） ──────────────────────────────────────

    /**
     * @notice 国库转账（仅 Governance 合约执行或 owner 紧急操作）
     * @param to          收款地址
     * @param amount      转账金额（wei）
     * @param note        转账说明
     * @param proposalRef 关联的 Governance 提案 ID（bytes32，可为 0）
     */
    function withdraw(
        address to,
        uint256 amount,
        string calldata note,
        bytes32 proposalRef
    ) external nonReentrant onlyGovernanceOrOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert ZeroAmount();

        totalWithdrawn += amount;

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(to, amount, note, proposalRef);
    }

    // ── 视图 ───────────────────────────────────────────────────────────────

    /// @notice 查询国库余额（wei）
    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice 查询资金流摘要
    function flowSummary() external view returns (
        uint256 currentBalance,
        uint256 deposited,
        uint256 withdrawn
    ) {
        return (address(this).balance, totalDeposited, totalWithdrawn);
    }
}
