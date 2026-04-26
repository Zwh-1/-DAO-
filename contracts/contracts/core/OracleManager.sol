// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice 去中心化预言机管理器
/// @dev    多签预言机报告链上病历/收入/事故证明；
///         极速通道（FastTrack）允许超过门槛数量签名者绕过 DAO 等待期直接批准申领。
contract OracleManager {
    // ── Custom Errors ──────────────────────────────────────────────────────
    error NotOracle();
    error AlreadySigned();
    error ReportExists();
    error InsufficientSigners();
    error Expired();
    error ReportNotFound();
    error GovernanceInterventionNotAllowed();
    error InvalidGovernanceAddress();
    error InsufficientStake();
    error NothingToUnstake();
    error TransferFailed();
    error AlreadyFinalized();
    error NotExpired();
    error SlashProposalNotFound();
    error SlashTimelockActive();
    error SlashAlreadyExecuted();
    error SlashNotApproved();
    error TimelockActive();
    error NoPendingGovernance();
    error NotAuthorized();
    error ReentrantCall();

    // ── Events ─────────────────────────────────────────────────────────────
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ReportSubmitted(bytes32 indexed reportId, address indexed oracle, bool fastTrack);
    event ReportFinalized(bytes32 indexed reportId, bool approved);
    event GovernanceForcedResolution(bytes32 indexed reportId, bool approved, string reason);
    event OracleStaked(address indexed oracle, uint256 amount);
    event OracleUnstaked(address indexed oracle, uint256 amount);
    event OracleSlashed(address indexed oracle, uint256 amount, string reason);
    event SlashProposed(bytes32 indexed proposalId, address indexed oracle, uint256 amount, string reason);
    event SlashApproved(bytes32 indexed proposalId);
    event SlashExecuted(bytes32 indexed proposalId, address indexed oracle, uint256 amount);
    event GovernanceProposed(address indexed proposed, uint256 unlockTime);
    event GovernanceAccepted(address indexed newGovernance);

    // ── Config ─────────────────────────────────────────────────────────────
    uint8   public constant MIN_QUORUM           = 3;
    uint8   public constant FASTTRACK_QUORUM     = 5;
    uint32  public constant REPORT_TTL           = 7 days;
    uint256 public constant MIN_STAKE            = 0.1 ether;
    uint256 public constant GOVERNANCE_TIMEOUT   = 14 days;
    uint256 public constant MIN_ACTIVE_ORACLES   = 2;
    uint256 public constant SLASH_TIMELOCK       = 2 days;
    uint256 public constant SETGOVERNANCE_DELAY  = 2 days;

    // ── Reentrancy Guard ───────────────────────────────────────────────────
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;
    uint256 private _reentrancyStatus;

    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) revert ReentrantCall();
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // ── Roles & Governance ─────────────────────────────────────────────────
    address public owner;
    address public governance;
    address public pendingGovernance;
    uint256 public governanceChangeUnlockTime;

    mapping(address => bool) public isOracle;
    address[] public oracles;

    // ── 质押管理 ────────────────────────────────────────────────────────────
    mapping(address => uint256) public oracleStakes;
    uint256 public totalStaked;

    // ── Slash 提案 ─────────────────────────────────────────────────────────
    struct SlashProposal {
        address oracle;
        uint256 amount;
        string  reason;
        uint256 executeAfter;
        bool    approved;
        bool    executed;
    }
    mapping(bytes32 => SlashProposal) public slashProposals;

    // ── Reports ────────────────────────────────────────────────────────────
    struct Report {
        bytes32 claimId;
        bytes32 dataHash;
        uint64  createdAt;
        uint8   signatures;
        bool    fastTrack;
        bool    finalized;
        bool    approved;
        mapping(address => bool)    signed;
        mapping(address => uint256) signatureTime;   // 每个签名者的签名时间戳，用于活性判断
    }

    mapping(bytes32 => Report)    private _reports;
    mapping(bytes32 => uint256)   public  reportLastActiveTime;
    mapping(bytes32 => bytes32[]) public  claimReports;          // claimId => reportIds

    // ── Modifiers ──────────────────────────────────────────────────────────
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

    modifier onlyOwnerOrGovernance() {
        if (msg.sender != owner && msg.sender != governance) revert NotAuthorized();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // ── Governance 管理（带时间锁的两步更换） ──────────────────────────────

    /// @notice 第一步：提议更换治理合约地址（2 天时间锁）
    function proposeGovernance(address _governance) external onlyOwner {
        if (_governance == address(0)) revert InvalidGovernanceAddress();
        pendingGovernance = _governance;
        governanceChangeUnlockTime = block.timestamp + SETGOVERNANCE_DELAY;
        emit GovernanceProposed(_governance, governanceChangeUnlockTime);
    }

    /// @notice 第二步：时间锁到期后确认生效
    function acceptGovernance() external onlyOwner {
        if (pendingGovernance == address(0)) revert NoPendingGovernance();
        if (block.timestamp < governanceChangeUnlockTime) revert TimelockActive();
        governance = pendingGovernance;
        pendingGovernance = address(0);
        emit GovernanceAccepted(governance);
    }

    // ── 质押 / 解质押（唯一注册途径，移除了 addOracle） ───────────────────

    /// @notice 质押成为预言机；首次质押自动注册，是唯一的注册途径
    function stake() external payable {
        if (msg.value < MIN_STAKE) revert InsufficientStake();

        oracleStakes[msg.sender] += msg.value;
        totalStaked += msg.value;

        if (!isOracle[msg.sender]) {
            isOracle[msg.sender] = true;
            oracles.push(msg.sender);
            emit OracleAdded(msg.sender);
        }

        emit OracleStaked(msg.sender, msg.value);
    }

    /// @notice 撤回全部质押并退出预言机
    function unstake() external nonReentrant {
        uint256 amount = oracleStakes[msg.sender];
        if (amount == 0) revert NothingToUnstake();

        // CEI：先更新所有状态，再转账
        oracleStakes[msg.sender] = 0;
        totalStaked -= amount;
        isOracle[msg.sender] = false;
        _removeOracleFromArray(msg.sender);

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit OracleUnstaked(msg.sender, amount);
        emit OracleRemoved(msg.sender);
    }

    // ── Slash 提案 / 审批 / 执行 ───────────────────────────────────────────

    /// @notice owner 提议惩罚预言机（需 DAO 批准 + 2 天时间锁后方可执行）
    function proposeSlash(
        address oracle,
        uint256 amount,
        string calldata reason
    ) external onlyOwner returns (bytes32 proposalId) {
        require(isOracle[oracle], "not oracle");
        proposalId = keccak256(abi.encodePacked(oracle, amount, block.timestamp, reason));
        slashProposals[proposalId] = SlashProposal({
            oracle:       oracle,
            amount:       amount,
            reason:       reason,
            executeAfter: block.timestamp + SLASH_TIMELOCK,
            approved:     false,
            executed:     false
        });
        emit SlashProposed(proposalId, oracle, amount, reason);
    }

    /// @notice 治理合约审批 slash 提案
    function approveSlash(bytes32 proposalId) external onlyGovernance {
        SlashProposal storage p = slashProposals[proposalId];
        if (p.executeAfter == 0) revert SlashProposalNotFound();
        if (p.executed)          revert SlashAlreadyExecuted();
        p.approved = true;
        emit SlashApproved(proposalId);
    }

    /// @notice 时间锁到期且 DAO 已批准后执行惩罚
    function executeSlash(bytes32 proposalId) external nonReentrant onlyOwner {
        SlashProposal storage p = slashProposals[proposalId];
        if (p.executeAfter == 0)              revert SlashProposalNotFound();
        if (p.executed)                        revert SlashAlreadyExecuted();
        if (block.timestamp < p.executeAfter) revert SlashTimelockActive();
        if (!p.approved)                       revert SlashNotApproved();

        // CEI：标记已执行后再操作资产
        p.executed = true;
        _doSlash(p.oracle, p.amount, p.reason);
        emit SlashExecuted(proposalId, p.oracle, p.amount);
    }

    function _doSlash(address oracle, uint256 amount, string memory reason) internal {
        uint256 staked = oracleStakes[oracle];
        if (staked == 0) revert InsufficientStake();
        uint256 slashAmt = amount > staked ? staked : amount;

        // CEI：先更新所有状态，再转账
        oracleStakes[oracle] -= slashAmt;
        totalStaked -= slashAmt;

        if (oracleStakes[oracle] == 0) {
            isOracle[oracle] = false;
            _removeOracleFromArray(oracle);
            emit OracleRemoved(oracle);
        }

        (bool ok,) = owner.call{value: slashAmt}("");
        if (!ok) revert TransferFailed();

        emit OracleSlashed(oracle, slashAmt, reason);
    }

    // ── Oracle 管理 ────────────────────────────────────────────────────────

    /// @notice 移除预言机（owner 或 governance 均可调用）
    function removeOracle(address o) external onlyOwnerOrGovernance {
        require(isOracle[o], "not oracle");
        isOracle[o] = false;
        _removeOracleFromArray(o);
        emit OracleRemoved(o);
    }

    // ── Report Lifecycle ───────────────────────────────────────────────────

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

        r.claimId                   = claimId;
        r.dataHash                  = dataHash;
        r.createdAt                 = uint64(block.timestamp);
        r.signatures                = 1;
        r.signed[msg.sender]        = true;
        r.signatureTime[msg.sender] = block.timestamp;

        reportLastActiveTime[reportId] = block.timestamp;
        claimReports[claimId].push(reportId);

        emit ReportSubmitted(reportId, msg.sender, false);
    }

    /// @notice 其他预言机对已存在报告追加签名
    function signReport(bytes32 reportId) external onlyOracle {
        Report storage r = _reports[reportId];
        if (r.createdAt == 0)                            revert ReportNotFound();
        if (r.finalized)                                 revert AlreadyFinalized();
        if (block.timestamp > r.createdAt + REPORT_TTL) revert Expired();
        if (r.signed[msg.sender])                        revert AlreadySigned();

        r.signed[msg.sender]        = true;
        r.signatureTime[msg.sender] = block.timestamp;
        r.signatures++;

        reportLastActiveTime[reportId] = block.timestamp;

        // 极速通道独立判断：达到 FASTTRACK_QUORUM 时直接终决并标记 fastTrack=true
        if (r.signatures >= FASTTRACK_QUORUM) {
            r.fastTrack = true;
            emit ReportSubmitted(reportId, msg.sender, true);
            _finalize(reportId, r);
        } else {
            emit ReportSubmitted(reportId, msg.sender, false);
            // 普通通道：达到 MIN_QUORUM 时按普通流程终决
            if (r.signatures >= MIN_QUORUM) {
                _finalize(reportId, r);
            }
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
        if (r.createdAt == 0)                            revert ReportNotFound();
        if (r.finalized)                                 revert AlreadyFinalized();
        if (block.timestamp <= r.createdAt + REPORT_TTL) revert NotExpired();

        r.finalized = true;
        r.approved  = false;
        emit ReportFinalized(reportId, false);
    }

    // ── 治理降级机制（Oracle 活性保护） ─────────────────────────────────────

    /// @notice 治理合约强制介入结算
    /// @param reason 介入理由（链上记录，防止恶意提前终止）
    function governanceForceResolve(
        bytes32         reportId,
        bool            approved,
        string calldata reason
    ) external onlyGovernance {
        Report storage r = _reports[reportId];
        if (r.createdAt == 0) revert ReportNotFound();
        if (r.finalized)      revert AlreadyFinalized();

        uint256 elapsed     = block.timestamp - reportLastActiveTime[reportId];
        uint256 activeCount = _getActiveOracleCount(reportId);

        bool timeoutCondition = elapsed > GOVERNANCE_TIMEOUT;
        bool oracleCondition  = activeCount < MIN_ACTIVE_ORACLES;

        if (!timeoutCondition && !oracleCondition) {
            revert GovernanceInterventionNotAllowed();
        }

        r.finalized = true;
        r.approved  = approved;

        emit GovernanceForcedResolution(reportId, approved, reason);
        emit ReportFinalized(reportId, approved);
    }

    /// @dev 统计报告中在最近 REPORT_TTL 内签名的活跃预言机数量
    function _getActiveOracleCount(bytes32 reportId) internal view returns (uint256 count) {
        uint256 cutoff = block.timestamp - REPORT_TTL;
        for (uint256 i = 0; i < oracles.length; i++) {
            address oracle = oracles[i];
            uint256 sigTime = _reports[reportId].signatureTime[oracle];
            if (sigTime != 0 && sigTime > cutoff) {
                count++;
            }
        }
    }

    // ── Internal Helpers ───────────────────────────────────────────────────

    function _removeOracleFromArray(address oracle) internal {
        for (uint256 i = 0; i < oracles.length; i++) {
            if (oracles[i] == oracle) {
                oracles[i] = oracles[oracles.length - 1];
                oracles.pop();
                break;
            }
        }
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

    function signatureTimeOf(bytes32 reportId, address oracle) external view returns (uint256) {
        return _reports[reportId].signatureTime[oracle];
    }

    function oracleCount() external view returns (uint256) {
        return oracles.length;
    }

    function getClaimReports(bytes32 claimId) external view returns (bytes32[] memory) {
        return claimReports[claimId];
    }
}
