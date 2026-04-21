// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PlatformRoleRegistry
 * @notice 应用层角色（与后端 RoleId 字符串对齐），由链上 grant/revoke 控制。
 * @dev 与 ArbitratorPool.isArbitrator 并行：arbitrator 可由池子判定，其余角色由此合约管理。
 */
contract PlatformRoleRegistry is AccessControl {
    /// @dev 与后端 ethers.id("member") 对齐
    bytes32 public constant ROLE_MEMBER = keccak256(abi.encodePacked("member"));
    bytes32 public constant ROLE_CHALLENGER = keccak256(abi.encodePacked("challenger"));
    bytes32 public constant ROLE_ORACLE = keccak256(abi.encodePacked("oracle"));
    bytes32 public constant ROLE_GUARDIAN = keccak256(abi.encodePacked("guardian"));
    bytes32 public constant ROLE_DAO = keccak256(abi.encodePacked("dao"));

    event AppRoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event AppRoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    constructor(address admin) {
        require(admin != address(0), "zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice 授予应用角色（需要 DEFAULT_ADMIN_ROLE）
     */
    function grantAppRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
        emit AppRoleGranted(role, account, msg.sender);
    }

    /**
     * @notice 撤销应用角色
     */
    function revokeAppRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
        emit AppRoleRevoked(role, account, msg.sender);
    }

    /**
     * @notice 查询是否拥有某应用角色（继承 AccessControl.hasRole）
     */
    function hasAppRole(bytes32 role, address account) external view returns (bool) {
        return hasRole(role, account);
    }
}
