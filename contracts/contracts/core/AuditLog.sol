// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice 链上审计日志合约
/// @dev    记录不可篡改的平台关键操作日志。
///         Guardian 调用 /v1/audit/publish 后由后端广播 appendLog()。
///         前端 /audit/flow、/audit/fraud、/audit/reports 页面可订阅事件。
contract AuditLog {
    // ── 自定义错误 ─────────────────────────────────────────────────────────

    error OnlyAuthorized();
    error EmptyContent();
    error ZeroAddress();

    // ── 日志类型 ───────────────────────────────────────────────────────────

    enum LogType {
        SystemPause,       // 系统暂停 / 恢复
        ClaimApproved,     // 理赔批准
        ClaimRejected,     // 理赔拒绝
        ChallengeResolved, // 挑战结算
        OracleSlashed,     // 预言机惩罚
        OraclePaused,      // 预言机暂停
        GovernanceExecuted,// 治理提案执行
        FraudDetected,     // 欺诈检测告警
        ReportPublished,   // 审计报告发布
        ContractUpgrade    // 合约升级
    }

    // ── 事件 ───────────────────────────────────────────────────────────────

    /// @notice 每条日志对应一个链上事件，前端可通过 ethers.js getLogs() 订阅
    event LogAppended(
        uint256 indexed logId,
        LogType indexed logType,
        address indexed actor,
        bytes32 refId,          // 关联 ID（claimId / proposalId / reportId 等）
        string  ipfsCid,        // 详细内容的 IPFS CID（链下）
        uint256 timestamp
    );

    event AuthorizerSet(address indexed authorizer, bool allowed);

    // ── 状态 ───────────────────────────────────────────────────────────────

    address public owner;
    mapping(address => bool) public authorizers;  // 允许写日志的地址（后端中继、Guardian 等）

    uint256 private _nextLogId = 1;

    struct LogEntry {
        uint256  logId;
        LogType  logType;
        address  actor;
        bytes32  refId;
        string   ipfsCid;
        uint256  timestamp;
    }

    mapping(uint256 => LogEntry) public logs;
    uint256 public totalLogs;

    // ── 构造 ───────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorizers[msg.sender] = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizers[msg.sender]) revert OnlyAuthorized();
        _;
    }

    // ── 配置 ───────────────────────────────────────────────────────────────

    /// @notice 设置写日志授权（owner 管理）
    function setAuthorizer(address authorizer, bool allowed) external onlyOwner {
        if (authorizer == address(0)) revert ZeroAddress();
        authorizers[authorizer] = allowed;
        emit AuthorizerSet(authorizer, allowed);
    }

    // ── 写日志 ─────────────────────────────────────────────────────────────

    /**
     * @notice 追加审计日志（仅授权地址）
     * @param logType  日志类型（0-9）
     * @param actor    操作发起者地址（可为后端中继地址）
     * @param refId    关联 ID（bytes32，可由 keccak256 生成）
     * @param ipfsCid  详细内容 IPFS CID（"" 表示无链下内容）
     *
     * @dev 对应后端接口：POST /v1/audit/publish → appendLog()
     */
    function appendLog(
        uint8   logType,
        address actor,
        bytes32 refId,
        string calldata ipfsCid
    ) external onlyAuthorized returns (uint256 logId) {
        if (actor == address(0)) revert ZeroAddress();
        if (logType > uint8(type(LogType).max)) revert EmptyContent();

        logId = _nextLogId++;
        totalLogs++;

        logs[logId] = LogEntry({
            logId:     logId,
            logType:   LogType(logType),
            actor:     actor,
            refId:     refId,
            ipfsCid:   ipfsCid,
            timestamp: block.timestamp
        });

        emit LogAppended(logId, LogType(logType), actor, refId, ipfsCid, block.timestamp);
    }

    // ── 查询 ───────────────────────────────────────────────────────────────

    /// @notice 查询单条日志
    function getLog(uint256 logId) external view returns (LogEntry memory) {
        return logs[logId];
    }

    /// @notice 批量查询最近 n 条日志（逆序）
    function getRecentLogs(uint256 n) external view returns (LogEntry[] memory result) {
        uint256 count = _nextLogId - 1;
        uint256 k = n > count ? count : n;
        result = new LogEntry[](k);
        for (uint256 i = 0; i < k; i++) {
            result[i] = logs[count - i];
        }
    }
}
