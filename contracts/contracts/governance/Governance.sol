// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SBT.sol";

/// @notice DAO 治理合约：加权投票 + 时间锁执行
/// @dev    去中心化重构版：权重自动来自 SBT 信用分与等级
///         投票权重公式：weight = creditScore + level * 10
///         提案通过后进入时间锁，超过 TIMELOCK_DELAY 后任何人可执行
contract Governance {
    error AlreadyVoted();
    error ProposalNotActive();
    error TimelockNotExpired();
    error ExecutionFailed();
    error NotProposer();
    error QuorumNotMet();
    error AlreadyExecuted();
    error NoVotingPower();
    error TargetNotAllowed();

    enum ProposalState { Pending, Active, Succeeded, Defeated, Queued, Executed, Cancelled }

    struct Proposal {
        address proposer;
        string  description;
        address target;       // 目标合约地址
        bytes   callData;     // 调用数据
        uint64  startTime;
        uint64  endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool    executed;
        bool    cancelled;
        uint64  queuedAt;    // 进入时间锁的时间
    }

    uint32 public constant VOTE_PERIOD     = 3 days;
    uint32 public constant TIMELOCK_DELAY  = 2 days;
    uint256 public constant QUORUM_WEIGHT  = 100;  // 最低通过权重总和

    address public owner;
    SBT public immutable sbt;
    
    // 时间锁白名单：仅允许执行白名单内的目标地址（安全增强）
    mapping(address => bool) public allowedTargets;

    uint256 private _nextProposalId = 1;
    mapping(uint256 => Proposal)                       public proposals;
    mapping(uint256 => mapping(address => bool))       public hasVoted;

    event ProposalCreated(uint256 indexed id, address indexed proposer, string description);
    event VoteCast(uint256 indexed id, address indexed voter, uint8 support, uint256 weight);
    event ProposalQueued(uint256 indexed id, uint64 executeAfter);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);
    event TargetAllowed(address indexed target, bool allowed);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address sbtAddress) {
        require(sbtAddress != address(0), "Zero address");
        sbt = SBT(sbtAddress);
        owner = msg.sender;
        // 初始化：允许 owner 作为首个可执行目标
        allowedTargets[msg.sender] = true;
    }

    // ── 权重管理（去中心化） ───────────────────────────────────────────────

    /**
     * @dev 自动计算投票权重（基于 SBT 信用分与等级）
     * @notice 去中心化核心：移除 owner 手动设置，公式 weight = creditScore + level * 10
     * @notice 信用分为主（0-1000），等级为辅（系数 10），防止高等级低信用用户操控
     */
    function getVotingWeight(address voter) public view returns (uint256) {
        (uint16 creditScore, uint8 level) = sbt.getIdentityScore(voter);
        return uint256(creditScore) + uint256(level) * 10;
    }

    /**
     * @dev 管理时间锁白名单（仅 owner）
     * @notice 安全增强：限制可执行目标地址，防止恶意调用
     */
    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
        emit TargetAllowed(target, allowed);
    }

    // ── 提案 ───────────────────────────────────────────────────────────────

    /**
     * @dev 创建提案（需有投票权重）
     * @notice 去中心化：自动从 SBT 获取权重，无需 owner 设置
     */
    function propose(
        string calldata description,
        address target,
        bytes  calldata callData
    ) external returns (uint256 id) {
        // 验证投票权重（自动从 SBT 计算）
        require(getVotingWeight(msg.sender) > 0, "no voting weight");

        id = _nextProposalId++;
        proposals[id] = Proposal({
            proposer:     msg.sender,
            description:  description,
            target:       target,
            callData:     callData,
            startTime:    uint64(block.timestamp),
            endTime:      uint64(block.timestamp + VOTE_PERIOD),
            forVotes:     0,
            againstVotes: 0,
            abstainVotes: 0,
            executed:     false,
            cancelled:    false,
            queuedAt:     0
        });

        emit ProposalCreated(id, msg.sender, description);
    }

    // ── 投票 ───────────────────────────────────────────────────────────────

    /**
     * @dev 投票（自动计算权重）
     * @notice 去中心化：权重来自 SBT 信用分与等级
     */
    function castVote(uint256 id, uint8 support) external {
        Proposal storage p = proposals[id];
        if (p.startTime == 0 || p.cancelled) revert ProposalNotActive();
        if (block.timestamp > p.endTime)     revert ProposalNotActive();
        if (hasVoted[id][msg.sender])        revert AlreadyVoted();

        // 自动计算投票权重（去中心化核心）
        uint256 w = getVotingWeight(msg.sender);
        if (w == 0) revert NoVotingPower();

        hasVoted[id][msg.sender] = true;

        if (support == 1)      p.forVotes     += w;
        else if (support == 0) p.againstVotes += w;
        else                   p.abstainVotes  += w;

        emit VoteCast(id, msg.sender, support, w);
    }

    // ── 排队进时间锁 ───────────────────────────────────────────────────────

    function queue(uint256 id) external {
        Proposal storage p = proposals[id];
        if (block.timestamp <= p.endTime)         revert ProposalNotActive();
        if (p.executed || p.cancelled)            revert AlreadyExecuted();
        if (p.queuedAt != 0)                      revert AlreadyExecuted();
        if (p.forVotes <= p.againstVotes)         revert QuorumNotMet();
        if (p.forVotes < QUORUM_WEIGHT)           revert QuorumNotMet();

        p.queuedAt = uint64(block.timestamp);
        emit ProposalQueued(id, uint64(block.timestamp + TIMELOCK_DELAY));
    }

    // ── 执行 ───────────────────────────────────────────────────────────────

    /**
     * @dev 执行提案（带时间锁与白名单检查）
     * @notice 安全增强：目标地址必须在白名单内，防止恶意调用
     */
    function execute(uint256 id) external {
        Proposal storage p = proposals[id];
        if (p.queuedAt == 0)                       revert ProposalNotActive();
        if (p.executed || p.cancelled)             revert AlreadyExecuted();
        if (block.timestamp < p.queuedAt + TIMELOCK_DELAY) revert TimelockNotExpired();

        p.executed = true;

        // 白名单检查（安全增强）
        if (p.target != address(0) && p.callData.length > 0) {
            if (!allowedTargets[p.target]) revert TargetNotAllowed();
            
            (bool success,) = p.target.call(p.callData);
            if (!success) revert ExecutionFailed();
        }

        emit ProposalExecuted(id);
    }

    // ── 取消 ───────────────────────────────────────────────────────────────

    function cancel(uint256 id) external {
        Proposal storage p = proposals[id];
        if (msg.sender != p.proposer && msg.sender != owner) revert NotProposer();
        require(!p.executed, "already executed");
        p.cancelled = true;
        emit ProposalCancelled(id);
    }

    // ── 状态查询 ───────────────────────────────────────────────────────────

    function state(uint256 id) external view returns (ProposalState) {
        Proposal storage p = proposals[id];
        if (p.startTime == 0)  return ProposalState.Pending;
        if (p.cancelled)       return ProposalState.Cancelled;
        if (p.executed)        return ProposalState.Executed;
        if (block.timestamp <= p.endTime) return ProposalState.Active;
        if (p.queuedAt != 0)   return ProposalState.Queued;
        if (p.forVotes > p.againstVotes && p.forVotes >= QUORUM_WEIGHT) return ProposalState.Succeeded;
        return ProposalState.Defeated;
    }
}
