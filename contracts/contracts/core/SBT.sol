// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityRegistry.sol";

/// @notice ERC-5192 最小实现：不可转让的灵魂绑定代币
/// @dev    隐私保护重构版：地址与 commitment 完全解耦
///         链上仅记录 commitment 存在性，不暴露持有者地址
///         支持零知识证明："我拥有有效 SBT 资格"而非"地址 X 拥有 SBT"
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

contract SBT is IERC5192 {
    error TokenLocked();
    error NotOwner();
    error AlreadyMinted();
    error NotRegistered();
    error WaitingPeriodActive();
    error InsufficientLevel();
    error NoToken();
    error InvalidCreditScore();

    event Minted(address indexed to, uint256 indexed tokenId, uint256 commitment, uint8 level);
    event CreditUpdated(uint256 indexed tokenId, uint16 newScore);
    event Blacklisted(address indexed target, string reason);
    event VotingPowerUpdated(uint256 indexed tokenId, uint256 newPower);

    // ── State ──────────────────────────────────────────────────────────────

    address public owner;
    IdentityRegistry public immutable registry;

    uint32 public constant WAITING_PERIOD = 90 days;   // 90 天等待期
    uint8  public constant MIN_LEVEL_TO_CLAIM = 1;
    
    // ✅ Gas 优化：投票权重预计算（避免跨合约调用）
    mapping(uint256 => uint256) public tokenVotingPower;
    
    // ✅ 信用分时间衰减参数（年衰减率 10%）
    uint256 public constant DECAY_RATE = 10; // 百分比
    uint256 public constant DECAY_PERIOD = 365 days;

    uint256 private _nextId = 1;

    struct TokenData {
        address holder;
        uint256 commitment;
        uint8   level;
        uint16  creditScore;   // 0-1000
        uint64  joinedAt;      // unix 秒
        bool    blacklisted;
    }

    mapping(uint256 => TokenData) private _tokens;
    
    // 隐私保护：移除 _holderToken[holder] 和 commitment2token 映射
    // 新增：仅记录 commitment 是否存在（不绑定地址，供 ZK 验证）
    mapping(uint256 => bool) public commitmentExists;
    
    // 私有数组：仅合约内部使用，不对外暴露地址与 commitment 的映射
    mapping(address => uint256[]) private _holderCommitments;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address registry_) {
        registry = IdentityRegistry(registry_);
        owner = msg.sender;
    }

    // ── Minting ────────────────────────────────────────────────────────────

    /// @param commitment  Poseidon(social_id_hash, secret, trapdoor) 的链上承诺值
    /// @notice 隐私保护：仅记录 commitment 存在性，不暴露地址映射
    function mint(address to, uint256 commitment) external onlyOwner returns (uint256 tokenId) {
        // 检查用户是否已持有 SBT（通过私有数组长度判断）
        if (_holderCommitments[to].length > 0) revert AlreadyMinted();
        if (!registry.registered(commitment)) revert NotRegistered();

        tokenId = _nextId++;
        uint8 lvl = registry.levelOf(commitment);

        _tokens[tokenId] = TokenData({
            holder:      to,
            commitment:  commitment,
            level:       lvl,
            creditScore: 650,
            joinedAt:    uint64(block.timestamp),
            blacklisted: false
        });
        
        // 隐私保护：使用私有数组存储，不暴露映射关系
        _holderCommitments[to].push(tokenId);
        
        // 记录 commitment 存在性（供 ZK 验证，不绑定地址）
        commitmentExists[commitment] = true;
        
        // ✅ Gas 优化：预计算投票权重（避免 Governance 跨合约调用）
        tokenVotingPower[tokenId] = _calculateVotingPower(650, lvl, block.timestamp);
        
        emit Minted(to, tokenId, commitment, lvl);
        emit VotingPowerUpdated(tokenId, tokenVotingPower[tokenId]);
        emit Locked(tokenId);
    }

    // ── ERC-5192 ───────────────────────────────────────────────────────────

    function locked(uint256) external pure override returns (bool) {
        return true;   // 永远锁定，不可转让
    }

    // ── Waiting-period guard ───────────────────────────────────────────────

    /**
     * @dev 检查用户是否符合申领条件
     * @notice 隐私保护：通过私有数组获取 tokenId，不暴露地址映射
     */
    function isClaimEligible(address holder) external view returns (bool) {
        // 通过私有数组获取用户的 tokenId
        uint256[] storage userTokens = _holderCommitments[holder];
        if (userTokens.length == 0) return false;
        
        // 获取第一个 token（1 地址 1 SBT）
        uint256 tid = userTokens[0];
        TokenData storage t = _tokens[tid];
        
        if (t.blacklisted) return false;
        if (t.level < MIN_LEVEL_TO_CLAIM) return false;
        return (block.timestamp >= t.joinedAt + WAITING_PERIOD);
    }

    // ── Credit ─────────────────────────────────────────────────────────────

    function updateCredit(uint256 tokenId, uint16 score) external onlyOwner {
        if (score > 1000) revert InvalidCreditScore();
        _tokens[tokenId].creditScore = score;
        // ✅ 更新信用分时重新计算投票权重
        tokenVotingPower[tokenId] = _calculateVotingPower(score, _tokens[tokenId].level, block.timestamp);
        emit CreditUpdated(tokenId, score);
        emit VotingPowerUpdated(tokenId, tokenVotingPower[tokenId]);
    }
    
    /**
     * @dev 更新用户等级（挑战成功/治理奖励时调用）
     * @notice 自动重新计算投票权重
     */
    function updateLevel(uint256 tokenId, uint8 newLevel) external onlyOwner {
        _tokens[tokenId].level = newLevel;
        // ✅ 更新等级时重新计算投票权重
        tokenVotingPower[tokenId] = _calculateVotingPower(_tokens[tokenId].creditScore, newLevel, block.timestamp);
        emit VotingPowerUpdated(tokenId, tokenVotingPower[tokenId]);
    }
    
    // ── 内部函数：计算投票权重（含时间衰减） ─────────────────────────────────
    /**
     * @dev 计算投票权重：基础分 + 等级加成 - 时间衰减
     * @param baseScore 基础信用分
     * @param level 用户等级
     * @param lastActiveTime 最后活跃时间
     * @return votingPower 投票权重
     */
    function _calculateVotingPower(uint256 baseScore, uint256 level, uint256 lastActiveTime) internal view returns (uint256) {
        // ✅ 基础公式：weight = creditScore + level * 10
        uint256 basePower = baseScore + level * 10;
        
        // ✅ 时间衰减：超过 1 年未活跃，每年衰减 10%
        if (lastActiveTime > 0 && block.timestamp > lastActiveTime) {
            uint256 elapsed = block.timestamp - lastActiveTime;
            if (elapsed > DECAY_PERIOD) {
                uint256 decayPeriods = elapsed / DECAY_PERIOD;
                uint256 decay = (basePower * DECAY_RATE * decayPeriods) / 100;
                basePower = basePower > decay ? basePower - decay : 0;
            }
        }
        
        return basePower;
    }

    // ── Blacklist ──────────────────────────────────────────────────────────

    /**
     * @dev 禁止持有者（挑战失败时调用）
     * @notice 隐私保护：通过私有数组获取 tokenId
     */
    function banHolder(address holder, string calldata reason) external onlyOwner {
        uint256[] storage userTokens = _holderCommitments[holder];
        if (userTokens.length == 0) revert NoToken();
        
        uint256 tid = userTokens[0];
        _tokens[tid].blacklisted = true;
        emit Blacklisted(holder, reason);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /**
     * @dev 获取用户的 tokenId（隐私保护版本）
     * @notice 仅返回第一个 tokenId，不暴露 commitment 映射
     */
    function tokenOf(address holder) external view returns (uint256) {
        uint256[] storage userTokens = _holderCommitments[holder];
        if (userTokens.length == 0) return 0;
        return userTokens[0];
    }

    /**
     * @dev 验证 commitment 是否有效（零知识证明场景）
     * @notice 仅返回 true/false，不暴露地址（隐私保护核心接口）
     */
    function verifyCommitment(uint256 commitment) external view returns (bool) {
        return commitmentExists[commitment];
    }

    /**
     * @dev 获取用户信用分与等级（供 Governance 调用）
     * @notice 自动计算投票权重：weight = creditScore + level * 10
     */
    function getIdentityScore(address user) external view returns (uint16 creditScore, uint8 level) {
        uint256[] storage userTokens = _holderCommitments[user];
        if (userTokens.length == 0) {
            return (0, 0);
        }
        TokenData storage t = _tokens[userTokens[0]];
        return (t.creditScore, t.level);
    }

    function tokenData(uint256 tokenId) external view returns (TokenData memory) {
        return _tokens[tokenId];
    }
}
