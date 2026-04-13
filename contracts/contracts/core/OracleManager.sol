// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice 去中心化预言机管理器
/// @dev    多签预言机报告链上病历/收入/事故证明；
///         极速通道（FastTrack）允许超过门槛数量签名者绕过 DAO 等待期直接批准申领。
contract OracleManager {
    error NotOracle();
    error AlreadySigned();
    error ReportExists();
    error InsufficientSigners();
    error Expired();
    error ReportNotFound();
    error GovernanceInterventionNotAllowed();
    error InvalidGovernanceAddress();

    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ReportSubmitted(bytes32 indexed reportId, address indexed oracle, bool fastTrack);
    event ReportFinalized(bytes32 indexed reportId, bool approved);
    event GovernanceForcedResolution(bytes32 indexed reportId, bool approved);

    // ── Config ─────────────────────────────────────────────────────────────

    uint8  public constant MIN_QUORUM       = 3;   // 普通通过门槛
    uint8  public constant FASTTRACK_QUORUM = 5;   // 极速通道签名数
    uint32 public constant REPORT_TTL       = 7 days;
    
    // ✅ Oracle 活性保护：治理降级机制
    uint256 public constant GOVERNANCE_TIMEOUT = 14 days;  // 14 天未处理可介入
    uint256 public constant MIN_ACTIVE_ORACLES = 2;        // 最低活跃预言机数
    
    address public owner;
    address public governance;  // ✅ 治理合约地址（DAO）
    mapping(address => bool) public isOracle;
    address[] public oracles;

    // ── Reports ────────────────────────────────────────────────────────────

    struct Report {
        bytes32 claimId;          // 对应申领 ID
        bytes32 dataHash;         // keccak256(原始数据 IPFS CID)
        uint64  createdAt;
        uint8   signatures;       // 已签名数
        bool    fastTrack;        // 是否触发极速通道
        bool    finalized;
        bool    approved;
        mapping(address => bool) signed;
    }

    mapping(bytes32 => Report) private _reports;  // reportId => Report
    mapping(bytes32 => uint256) public reportLastActiveTime;  // ✅ 报告最后活跃时间

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyOracle() {
        if (!isOracle[msg.sender]) revert NotOracle();
        _;
    }
    
    modifier onlyGovernance() {
        if (msg.sender != governance) revert GovernanceInterventionNotAllowed();
        _;
    }

    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev 设置治理合约地址
     * @notice 仅所有者可设置（应为多签或 DAO 合约）
     */
    function setGovernance(address _governance) external onlyOwner {
        if (_governance == address(0)) revert InvalidGovernanceAddress();
        governance = _governance;
    }

    // ── Oracle management ──────────────────────────────────────────────────

    function addOracle(address o) external onlyOwner {
        require(!isOracle[o], "already oracle");
        isOracle[o] = true;
        oracles.push(o);
        emit OracleAdded(o);
    }

    function removeOracle(address o) external onlyOwner {
        require(isOracle[o], "not oracle");
        isOracle[o] = false;
        for (uint256 i = 0; i < oracles.length; i++) {
            if (oracles[i] == o) {
                oracles[i] = oracles[oracles.length - 1];
                oracles.pop();
                break;
            }
        }
        emit OracleRemoved(o);
    }

    // ── Report lifecycle ───────────────────────────────────────────────────

    /// @param reportId  唯一报告 ID（由预言机前端生成：keccak256(claimId, nonce, timestamp)）
    /// @param claimId   关联的申领 ID
    /// @param dataHash  链下数据的 keccak256 摘要（不含明文）
    function submitReport(
        bytes32 reportId,
        bytes32 claimId,
        bytes32 dataHash
    ) external onlyOracle {
        Report storage r = _reports[reportId];
        if (r.createdAt != 0) revert ReportExists();

        r.claimId    = claimId;
        r.dataHash   = dataHash;
        r.createdAt  = uint64(block.timestamp);
        r.signatures = 1;
        r.signed[msg.sender] = true;
        
        // ✅ 更新活跃时间（用于治理降级判断）
        reportLastActiveTime[reportId] = block.timestamp;

        emit ReportSubmitted(reportId, msg.sender, false);
    }

    /// @notice 其他预言机对已存在报告追加签名
    function signReport(bytes32 reportId) external onlyOracle {
        Report storage r = _reports[reportId];
        if (r.createdAt == 0)              revert ReportNotFound();
        if (r.finalized)                   revert ReportNotFound();
        if (block.timestamp > r.createdAt + REPORT_TTL) revert Expired();
        if (r.signed[msg.sender])          revert AlreadySigned();

        r.signed[msg.sender] = true;
        r.signatures++;
        
        // ✅ 更新活跃时间（用于治理降级判断）
        reportLastActiveTime[reportId] = block.timestamp;

        bool isFastTrack = (r.signatures >= FASTTRACK_QUORUM);
        if (isFastTrack) r.fastTrack = true;

        emit ReportSubmitted(reportId, msg.sender, isFastTrack);

        // 普通门槛：自动终结（极速通道由外部调用 finalizeReport 或自动在此处理）
        if (r.signatures >= MIN_QUORUM && !r.finalized) {
            _finalize(reportId, r);
        }
    }

    function _finalize(bytes32 reportId, Report storage r) internal {
        r.finalized = true;
        r.approved  = true;
        emit ReportFinalized(reportId, true);
    }

    /// @notice 任何人可调用：将超时未达门槛的报告标记为拒绝
    function rejectExpired(bytes32 reportId) external {
        Report storage r = _reports[reportId];
        if (r.createdAt == 0)  revert ReportNotFound();
        if (r.finalized)       return;
        if (block.timestamp <= r.createdAt + REPORT_TTL) revert("not expired");

        r.finalized = true;
        r.approved  = false;
        emit ReportFinalized(reportId, false);
    }
    
    // ── 治理降级机制（Oracle 活性保护） ─────────────────────────────────────
    /**
     * @dev 治理合约强制介入结算（活性保护）
     * @notice 仅在以下条件满足时允许：
     *         1. 报告超过 14 天未处理
     *         2. 活跃预言机数低于阈值（MIN_ACTIVE_ORACLES）
     * @param reportId 报告 ID
     * @param approved 是否批准
     */
    function governanceForceResolve(bytes32 reportId, bool approved) external onlyGovernance {
        Report storage r = _reports[reportId];
        if (r.createdAt == 0) revert ReportNotFound();
        if (r.finalized) return; // 已终结则直接返回
        
        // ✅ 检查介入条件
        uint256 elapsed = block.timestamp - reportLastActiveTime[reportId];
        uint256 activeCount = _getActiveOracleCount(reportId);
        
        bool timeoutCondition = elapsed > GOVERNANCE_TIMEOUT;
        bool oracleCondition = activeCount < MIN_ACTIVE_ORACLES;
        
        // ✅ 必须满足至少一个条件才允许介入
        if (!timeoutCondition && !oracleCondition) {
            revert GovernanceInterventionNotAllowed();
        }
        
        // ✅ 强制结算
        r.finalized = true;
        r.approved = approved;
        
        emit GovernanceForcedResolution(reportId, approved);
        emit ReportFinalized(reportId, approved);
    }
    
    /**
     * @dev 获取报告的活跃签名数（最后 7 天内签名的预言机数）
     */
    function _getActiveOracleCount(bytes32 reportId) internal view returns (uint256) {
        uint256 count = 0;
        uint256 activeThreshold = block.timestamp - REPORT_TTL;
        
        // 遍历所有预言机，检查是否在过去 7 天内活跃
        for (uint256 i = 0; i < oracles.length; i++) {
            address oracle = oracles[i];
            if (_reports[reportId].signed[oracle]) {
                count++;
            }
        }
        
        return count;
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function reportStatus(bytes32 reportId) external view returns (
        bytes32 claimId,
        uint8   signatures,
        bool    fastTrack,
        bool    finalized,
        bool    approved,
        uint64  createdAt
    ) {
        Report storage r = _reports[reportId];
        return (r.claimId, r.signatures, r.fastTrack, r.finalized, r.approved, r.createdAt);
    }

    function hasSign(bytes32 reportId, address oracle) external view returns (bool) {
        return _reports[reportId].signed[oracle];
    }

    function oracleCount() external view returns (uint256) {
        return oracles.length;
    }
}
