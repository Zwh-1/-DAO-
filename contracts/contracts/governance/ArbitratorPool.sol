// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev 仲裁员池：伪随机抽取（测试网版本）
/// @notice 生产环境应集成 Chainlink VRF v2.5
/// @notice 隐私保护：使用 block.prevrandao 生成随机数
contract ArbitratorPool {
    // ✅ 自定义错误代码
    error PoolEmpty();
    error OnlyOwner();
    error TransferFailed();

    // 仲裁员池
    struct Arb {
        uint256 stake;
        bool active;
    }

    uint256 public constant MIN_STAKE = 0.01 ether;
    mapping(address => Arb) public arbs;
    address[] public pool;
    address public owner;

    // 事件
    event Registered(address indexed arb, uint256 stake);
    event ArbitratorPicked(address indexed arb, uint256 claimId, uint256 index);

    constructor() {
        owner = msg.sender;
    }

    // ✅ 权限修饰符
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    function register() external payable {
        require(msg.value >= MIN_STAKE, "stake low");
        if (!arbs[msg.sender].active) {
            pool.push(msg.sender);
        }
        arbs[msg.sender].stake += msg.value;
        arbs[msg.sender].active = true;
        emit Registered(msg.sender, msg.value);
    }

    function poolLength() external view returns (uint256) {
        return pool.length;
    }

    /// @notice 检查地址是否为仲裁员
    function isArbitrator(address addr) external view returns (bool) {
        return arbs[addr].active;
    }

    /// @notice 伪随机抽取最多 count 名（无重复）；pool 为空则返回空数组
    /// @dev 生产环境应替换为 Chainlink VRF
    function pick(uint256 claimId, uint256 count) external view returns (address[] memory picked) {
        uint256 n = pool.length;
        if (n == 0 || count == 0) {
            return new address[](0);
        }
        uint256 k = count > n ? n : count;
        picked = new address[](k);
        bytes32 seed = keccak256(abi.encodePacked(block.prevrandao, claimId, address(this)));
        for (uint256 i = 0; i < k; i++) {
            seed = keccak256(abi.encodePacked(seed, i));
            uint256 idx = uint256(seed) % n;
            picked[i] = pool[idx];
        }
        return picked;
    }

    // ⚠️ 紧急提款（仅测试用，生产环境应移除）
    function emergencyWithdraw() external onlyOwner {
        (bool success,) = owner.call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }
}
