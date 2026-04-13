// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ArbitratorPool.sol";
import "../core/SBT.sol";
import "../core/IdentityRegistry.sol";

/// @notice 挑战 - 仲裁流程：独立奖励结算版
/// @dev    每个提案锁定专属奖励，防止"后进无钱"问题
///         仲裁员通过 Commit-Reveal 投票；多数票决定挑战是否成立。
///         挑战者胜利：获回质押 + 惩罚金（来自申领方）。
///         挑战者失败：质押锁定为该提案专属奖励。
contract ChallengeManager is ReentrancyGuard {
    // ✅ 自定义错误代码
    error WrongPhase();
    error AlreadyCommitted();
    error NotAnArbitrator();
    error RevealMismatch();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NotEnoughReveals();
    error TransferFailed();
    error AccusedNotFound();
    error ChallengeNotResolved(uint256 proposalId);
    error RewardNotLocked(uint256 proposalId);
    error AlreadyClaimed(uint256 proposalId);

    enum Phase { None, Open, Commit, Reveal, Resolved }

    struct VoteRecord {
        bytes32 commitment;
        uint256   vote;        // ✅ 改为 uint256（避免类型转换）
        bool    revealed;
        bool    rewardClaimed; // ✅ 奖励领取标记（独立于投票）
    }

    struct Challenge {
        address  challenger;
        address  accused;        // 被挑战者（申领人）地址
        uint256  proposalId;
        uint256  stake;          // 挑战者质押（ETH wei）
        uint256  lockedReward;   // ✅ 锁定的该提案专属奖励
        uint256  claimedReward;  // ✅ 已领取的奖励总额
        Phase    phase;
        uint64   commitDeadline;
        uint64   revealDeadline;
        uint8    votesFor;       // 支持挑战
        uint8    votesAgainst;   // 驳回挑战
        bool     challengerWins;
        bool     rewarded;       // 防止重复结算
    }

    ArbitratorPool public immutable pool;
    SBT public immutable sbt;
    IdentityRegistry public immutable registry;
    address public owner;

    uint32 public constant COMMIT_WINDOW = 1 days;
    uint32 public constant REVEAL_WINDOW = 1 days;
    uint8  public constant MIN_REVEAL    = 2;   // 至少 2 票方可结算

    // ✅ 全局奖励池（仅用于累加，不直接分配）
    uint256 public totalArbitratorRewardPool;

    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => VoteRecord)) public votes;
    mapping(uint256 => address[]) private _voters;  // 记录参与仲裁员列表

    event ChallengeOpened(uint256 indexed proposalId, address indexed challenger, address indexed accused, uint256 stake);
    event CommitSubmitted(uint256 indexed proposalId, address indexed arbitrator, bytes32 commitment);
    event Revealed(uint256 indexed proposalId, address indexed arbitrator, uint256 vote);
    event Resolved(uint256 indexed proposalId, bool challengerWins, uint256 payout);
    event RewardLocked(uint256 indexed proposalId, uint256 amount);
    event ArbitratorRewarded(address indexed arbitrator, uint256 indexed proposalId, uint256 amount);
    event AccusedPenalized(address indexed accused, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address pool_, address sbtAddress, address registryAddress) {
        pool = ArbitratorPool(pool_);
        require(sbtAddress != address(0), "Zero sbt");
        require(registryAddress != address(0), "Zero registry");
        sbt = SBT(sbtAddress);
        registry = IdentityRegistry(registryAddress);
        owner = msg.sender;
    }

    // ── 阶段 1：挑战者发起 ──────────────────────────────────────────────────

    /**
     * @dev 发起挑战（需指定被挑战者与质押）
     * @notice 质押惩罚：挑战成功时跨合约调用 SBT.banHolder() 自动降级
     * @param proposalId 提案 ID
     * @param accused 被挑战者（申领人）地址
     */
    function openChallenge(uint256 proposalId, address accused) external payable {
        require(msg.value > 0, "need stake");
        require(accused != address(0), "zero accused");
        require(challenges[proposalId].phase == Phase.None, "exists");

        challenges[proposalId] = Challenge({
            challenger:      msg.sender,
            accused:         accused,
            proposalId:      proposalId,
            stake:           msg.value,
            lockedReward:    0,
            claimedReward:   0,
            phase:           Phase.Open,
            commitDeadline:  uint64(block.timestamp + COMMIT_WINDOW),
            revealDeadline:  uint64(block.timestamp + COMMIT_WINDOW + REVEAL_WINDOW),
            votesFor:        0,
            votesAgainst:    0,
            challengerWins:  false,
            rewarded:        false
        });
        emit ChallengeOpened(proposalId, msg.sender, accused, msg.value);
    }

    // ── 阶段 2：进入 Commit 阶段（任意人调用，通常由后端调用） ────────────────

    function beginCommit(uint256 proposalId) external {
        Challenge storage c = challenges[proposalId];
        if (c.phase != Phase.Open) revert WrongPhase();
        c.phase = Phase.Commit;
    }

    // ── 阶段 3：仲裁员提交承诺 ──────────────────────────────────────────────

    /// @param commitment  keccak256(abi.encodePacked(vote, salt))
    function commitVote(uint256 proposalId, bytes32 commitment) external {
        Challenge storage c = challenges[proposalId];
        if (c.phase != Phase.Commit)               revert WrongPhase();
        if (block.timestamp > c.commitDeadline)    revert DeadlinePassed();
        if (!pool.isArbitrator(msg.sender))        revert NotAnArbitrator();

        VoteRecord storage v = votes[proposalId][msg.sender];
        if (v.commitment != bytes32(0))            revert AlreadyCommitted();

        v.commitment = commitment;
        _voters[proposalId].push(msg.sender);

        emit CommitSubmitted(proposalId, msg.sender, commitment);
    }

    // ── 阶段 4：Reveal ────────────────────────────────────────────────────

    function revealVote(uint256 proposalId, uint256 vote, bytes32 salt) external {
        Challenge storage c = challenges[proposalId];
        if (c.phase != Phase.Commit && c.phase != Phase.Reveal) revert WrongPhase();
        if (c.phase == Phase.Commit) {
            if (block.timestamp <= c.commitDeadline) revert DeadlineNotPassed();
            c.phase = Phase.Reveal;
        }
        if (block.timestamp > c.revealDeadline) revert DeadlinePassed();

        VoteRecord storage v = votes[proposalId][msg.sender];
        bytes32 h = keccak256(abi.encodePacked(vote, salt));
        if (v.commitment != h) revert RevealMismatch();
        require(!v.revealed, "already revealed");

        v.vote    = vote;
        v.revealed = true;

        if (vote == 1) c.votesFor++;
        else           c.votesAgainst++;

        emit Revealed(proposalId, msg.sender, vote);
    }

    // ── 阶段 5：结算（独立奖励锁定） ────────────────────────────────────────────

    /**
     * @dev 结算挑战（独立奖励锁定机制）
     * @notice 挑战成功：跨合约调用 SBT.banHolder() 自动降级信用分
     * @notice 挑战失败：质押锁定为该提案专属奖励（非全局池）
     */
    function resolve(uint256 proposalId) external nonReentrant {
        Challenge storage c = challenges[proposalId];
        if (c.phase != Phase.Reveal)                   revert WrongPhase();
        if (block.timestamp <= c.revealDeadline)        revert DeadlineNotPassed();
        if (c.rewarded)                                 revert WrongPhase();

        uint8 totalReveals = c.votesFor + c.votesAgainst;
        if (totalReveals < MIN_REVEAL)                 revert NotEnoughReveals();

        c.phase    = Phase.Resolved;
        c.rewarded = true;

        bool challengerWins = c.votesFor > c.votesAgainst;
        c.challengerWins    = challengerWins;

        uint256 payout;
        if (challengerWins) {
            // 挑战成立：惩罚被挑战者（申领人）
            // 1. 跨合约调用 SBT.banHolder() 自动降级信用分
            if (c.accused != address(0)) {
                try sbt.banHolder(c.accused, "ChallengeFailed") {
                    emit AccusedPenalized(c.accused, "Credit score reduced by 30%");
                } catch {
                    // banHolder 失败不影响挑战结果（降级非必需）
                }
            }
            
            // 2. 退回质押给挑战者
            payout = c.stake;
            (bool ok,) = c.challenger.call{value: payout}("");
            if (!ok) revert TransferFailed();
        } else {
            // ✅ 挑战失败：质押锁定为该提案专属奖励（非全局池）
            c.lockedReward = c.stake;
            totalArbitratorRewardPool += c.stake;
            payout = 0;
            
            emit RewardLocked(proposalId, c.lockedReward);
        }

        emit Resolved(proposalId, challengerWins, payout);
    }

    // ── 仲裁员提取奖励（独立结算） ────────────────────────────────────────────

    /// @notice 仲裁员按提案独立提取奖励（防止"后进无钱"问题）
    function claimArbitratorReward(uint256 proposalId) external nonReentrant {
        Challenge storage c = challenges[proposalId];
        if (c.phase != Phase.Resolved) revert ChallengeNotResolved(proposalId);
        
        VoteRecord storage v = votes[proposalId][msg.sender];
        if (!v.revealed) revert NotAnArbitrator();
        if (v.rewardClaimed) revert AlreadyClaimed(proposalId);
        if (c.lockedReward == 0) revert RewardNotLocked(proposalId);

        // ✅ 计算该仲裁员应得奖励
        address[] storage voters = _voters[proposalId];
        uint256 numVoters = voters.length;
        require(numVoters > 0, "no voters");
        
        uint256 rewardPerVoter = (c.lockedReward - c.claimedReward) / numVoters;
        require(rewardPerVoter > 0, "no reward");

        v.rewardClaimed = true;
        c.claimedReward += rewardPerVoter;

        // ⚠️ Gas 热点：外部调用（使用 call 而非 transfer）
        (bool ok,) = msg.sender.call{value: rewardPerVoter}("");
        if (!ok) revert TransferFailed();
        
        emit ArbitratorRewarded(msg.sender, proposalId, rewardPerVoter);
    }

    // ── 管理员强制结算（超时兜底） ─────────────────────────────────────────

    function forceResolve(uint256 proposalId, bool challengerWins) external onlyOwner {
        Challenge storage c = challenges[proposalId];
        require(c.phase != Phase.None && c.phase != Phase.Resolved, "invalid phase");
        c.phase         = Phase.Resolved;
        c.rewarded      = true;
        c.challengerWins = challengerWins;
        emit Resolved(proposalId, challengerWins, 0);
    }

    // ── 辅助函数 ─────────────────────────────────────────────────────────

    /// @notice 获取参与投票的仲裁员列表
    function getVoters(uint256 proposalId) external view returns (address[] memory) {
        return _voters[proposalId];
    }

    /// @notice 获取投票人数
    function getVoterCount(uint256 proposalId) external view returns (uint256) {
        return _voters[proposalId].length;
    }

    receive() external payable {
        totalArbitratorRewardPool += msg.value;
    }
}
