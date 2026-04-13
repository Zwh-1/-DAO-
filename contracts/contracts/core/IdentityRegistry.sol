// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev 身份承诺注册表：不存储任何 Web2 明文，仅链上承诺与等级、黑名单
/// @notice 隐私保护：仅记录 commitment 存在性与等级，不绑定地址
///         配合 SBT.sol 实现完全匿名化身份系统
contract IdentityRegistry {
    // ✅ 自定义错误代码（节省 Gas 且便于调试）
    error IdentityBlacklisted();
    error CommitmentNotRegistered();
    error CommitmentExpired();

    event CommitmentRegistered(uint256 indexed commitment, uint8 level);
    event IdentityBanApplied(uint256 indexed commitment, string reason);
    event LevelUpdated(uint256 indexed commitment, uint8 newLevel);
    event CommitmentExpirySet(uint256 indexed commitment, uint256 expiryTime);

    address public owner;
    
    // 承诺注册表：记录 commitment 是否已注册（不绑定地址）
    mapping(uint256 => bool) public registered;
    
    // 黑名单：被挑战失败的 commitment 将被标记
    mapping(uint256 => bool) public blacklisted;
    
    // 等级映射：commitment -> level（供 SBT 铸造时读取）
    mapping(uint256 => uint8) public levelOf;
    
    // ✅ 承诺过期时间：0 表示永不过期
    mapping(uint256 => uint256) public commitmentExpiry;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev 注册身份承诺（仅 owner 可调用）
     * @notice 隐私保护：仅记录 commitment 存在性，不绑定地址
     * @param commitment Poseidon(social_id_hash, secret, trapdoor) 的链上承诺
     * @param level 用户等级（基于 Web2 社交关联计算）
     */
    function registerCommitment(uint256 commitment, uint8 level) external onlyOwner {
        registered[commitment] = true;
        levelOf[commitment] = level;
        emit CommitmentRegistered(commitment, level);
    }

    /**
     * @dev 更新承诺等级（仅 owner 可调用）
     * @notice 用于用户等级提升后的链上更新
     */
    function setLevel(uint256 commitment, uint8 newLevel) external onlyOwner {
        if (!registered[commitment]) revert CommitmentNotRegistered();
        levelOf[commitment] = newLevel;
        emit LevelUpdated(commitment, newLevel);
    }

    /**
     * @dev 禁止身份承诺（挑战失败时调用）
     * @notice 与 SBT.banHolder 联动，实现跨合约惩罚
     */
    function banCommitment(uint256 commitment, string calldata reason) external onlyOwner {
        blacklisted[commitment] = true;
        emit IdentityBanApplied(commitment, reason);
    }

    /**
     * @dev 强制检查承诺状态（抛出错误代码）
     * @notice 推荐调用此函数，若不通过会直接 revert
     * @param commitment 身份承诺哈希
     */
    function checkCommitmentStatus(uint256 commitment) external view {
        if (!registered[commitment]) {
            revert CommitmentNotRegistered();
        }
        if (blacklisted[commitment]) {
            revert IdentityBlacklisted();
        }
        // ✅ 检查过期时间
        uint256 expiry = commitmentExpiry[commitment];
        if (expiry > 0 && block.timestamp > expiry) {
            revert CommitmentExpired();
        }
    }

    /**
     * @dev 检查承诺是否活跃（向后兼容）
     * @notice SBT 铸造前必须调用此函数验证
     */
    function isCommitmentActive(uint256 commitment) external view returns (bool) {
        try this.checkCommitmentStatus(commitment) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev 设置承诺过期时间（仅 owner 可调用）
     * @notice 用于身份凭证有效期管理
     * @param commitment 身份承诺哈希
     * @param expiryTime 过期时间戳（0 表示永不过期）
     */
    function setCommitmentExpiry(uint256 commitment, uint256 expiryTime) external onlyOwner {
        commitmentExpiry[commitment] = expiryTime;
        emit CommitmentExpirySet(commitment, expiryTime);
    }
}
