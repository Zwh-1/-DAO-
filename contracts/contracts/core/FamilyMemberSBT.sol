// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SBT.sol";

/**
 * @title FamilyMemberSBT
 * @dev 基于 ERC-5192 标准的灵魂绑定代币，用于 TrustAid 家庭成员身份确权。
 */
contract FamilyMemberSBT is IERC5192 {

    // ─────────────────────── 错误定义 ───────────────────────
    error NotAuthorized();
    error AlreadyMinted();
    error InvalidRelationship();
    error PrimaryHolderNoSBT();
    error NoToken();
    error InviteNotFound();
    error InviteAlreadyUsed();

    // ─────────────────────── 状态变量 ───────────────────────
    address public admin;
    SBT public immutable primarySBT;
    uint256 private _nextId = 1;

    struct MemberInfo {
        bytes32 memberIdHash;   // 身份哈希
        address primaryHolder;  // 所属主账户
        uint64  joinTimestamp;  // 加入时间
        uint8   relationship;   // 关系类型 (1-5)
        bool    isActive;       // 激活状态
    }

    // ─────────────────────── 邀请结构（两阶段双方共识）───────
    struct InviteInfo {
        address primaryHolder;  // 邀请发起方（主账户，必须持有主 SBT）
        address invitee;        // 被邀请的成员钱包地址
        bytes32 memberIdHash;   // 证件号哈希
        uint8   relationship;   // 关系类型
        bool    active;         // true=待接受, false=已使用/已取消
    }

    mapping(uint256 => MemberInfo) private _members;
    mapping(uint256 => address) private _owners;
    mapping(bytes32 => uint256) private _hashToToken;
    mapping(address => uint256[]) private _holderTokens;

    // inviteHash => InviteInfo（邀请哈希 = keccak256(primaryHolder, invitee, memberIdHash, relationship)）
    mapping(bytes32 => InviteInfo) private _invites;
    // invitee => inviteHash[]（方便被邀请方查询待处理邀请）
    mapping(address => bytes32[]) private _inviteeInvites;

    // ─────────────────────── 事件 ──────────────────────────
    event MemberMinted(uint256 indexed tokenId, address indexed to, bytes32 indexed hash, uint8 rel);
    event StatusUpdated(uint256 indexed tokenId, bool isActive);
    event InviteCreated(bytes32 indexed inviteHash, address indexed primaryHolder, address indexed invitee, uint8 relationship);
    event InviteAccepted(bytes32 indexed inviteHash, uint256 indexed tokenId);
    event InviteCancelled(bytes32 indexed inviteHash);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAuthorized();
        _;
    }

    modifier onlyAdminOrHolder(uint256 tokenId) {
        if (msg.sender != admin && msg.sender != _members[tokenId].primaryHolder)
            revert NotAuthorized();
        _;
    }

    constructor(address primarySBT_) {
        primarySBT = SBT(primarySBT_);
        admin = msg.sender;
    }

    // ─────────────────────── ERC-5192 接口 ──────────────────
    function locked(uint256) external pure override returns (bool) {
        return true; 
    }

    // ─────────────────────── 核心功能 ───────────────────────

    /**
     * @notice 铸造家庭成员 SBT
     * @param to 成员的钱包地址
     * @param memberIdHash 证件号哈希
     * @param relationship 关系 (1:配偶, 2:子女, 3:父母, 4:兄弟姐妹, 5:其他)
     */
    function mintMember(
        address to,
        bytes32 memberIdHash,
        uint8   relationship
    ) external returns (uint256 tokenId) {
        // 校验
        if (relationship == 0 || relationship > 5) revert InvalidRelationship();
        if (_hashToToken[memberIdHash] != 0) revert AlreadyMinted();
        
        // 权限：非管理员必须持有主 SBT 才能添加成员
        if (msg.sender != admin) {
            if (primarySBT.tokenOf(msg.sender) == 0) revert PrimaryHolderNoSBT();
        }

        tokenId = _nextId++;

        // 状态写入 (Slot Packing 优化)
        _members[tokenId] = MemberInfo({
            memberIdHash:  memberIdHash,
            primaryHolder: msg.sender,
            joinTimestamp: uint64(block.timestamp),
            relationship:  relationship,
            isActive:      true
        });

        _owners[tokenId] = to; // 映射地址，解决 Unused parameter 警告
        _hashToToken[memberIdHash] = tokenId;
        _holderTokens[msg.sender].push(tokenId);

        emit MemberMinted(tokenId, to, memberIdHash, relationship);
        emit Locked(tokenId);
    }

    /**
     * @notice 修改状态（对应前端的“移除”功能）
     */
    function updateStatus(uint256 tokenId, bool isActive) 
        external 
        onlyAdminOrHolder(tokenId) 
    {
        if (_members[tokenId].joinTimestamp == 0) revert NoToken();
        _members[tokenId].isActive = isActive;
        emit StatusUpdated(tokenId, isActive);
    }

    // ─────────────────────── 查询接口 ───────────────────────

    function getMember(uint256 tokenId) external view returns (MemberInfo memory) {
        if (_members[tokenId].joinTimestamp == 0) revert NoToken();
        return _members[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function tokensOfHolder(address holder) external view returns (uint256[] memory) {
        return _holderTokens[holder];
    }

    // ─────────────────────── 两阶段邀请：双方共识上链 ────────

    /**
     * @notice 第一阶段：主账户发起邀请（主账户钱包签名，消耗 gas）
     * @dev    仅创建邀请记录，不铸造 SBT；被邀请方需调用 acceptInvite 才会上链
     */
    function createInvite(
        address invitee,
        bytes32 memberIdHash,
        uint8   relationship
    ) external returns (bytes32 inviteHash) {
        if (relationship == 0 || relationship > 5) revert InvalidRelationship();
        if (_hashToToken[memberIdHash] != 0) revert AlreadyMinted();
        if (msg.sender != admin) {
            if (primarySBT.tokenOf(msg.sender) == 0) revert PrimaryHolderNoSBT();
        }

        inviteHash = keccak256(abi.encodePacked(msg.sender, invitee, memberIdHash, relationship));
        _invites[inviteHash] = InviteInfo({
            primaryHolder: msg.sender,
            invitee:       invitee,
            memberIdHash:  memberIdHash,
            relationship:  relationship,
            active:        true
        });
        _inviteeInvites[invitee].push(inviteHash);

        emit InviteCreated(inviteHash, msg.sender, invitee, relationship);
    }

    /**
     * @notice 第二阶段：被邀请方接受邀请（成员钱包签名，正式铸造 SBT）
     * @dev    只有 invitee 本人才能调用；调用成功后 SBT 铸造完成
     */
    function acceptInvite(bytes32 inviteHash) external returns (uint256 tokenId) {
        InviteInfo storage invite = _invites[inviteHash];
        if (!invite.active)          revert InviteAlreadyUsed();
        if (invite.invitee != msg.sender) revert NotAuthorized();
        if (_hashToToken[invite.memberIdHash] != 0) revert AlreadyMinted();

        invite.active = false;

        tokenId = _nextId++;
        _members[tokenId] = MemberInfo({
            memberIdHash:  invite.memberIdHash,
            primaryHolder: invite.primaryHolder,
            joinTimestamp: uint64(block.timestamp),
            relationship:  invite.relationship,
            isActive:      true
        });
        _owners[tokenId]  = invite.invitee;
        _hashToToken[invite.memberIdHash] = tokenId;
        _holderTokens[invite.primaryHolder].push(tokenId);

        emit InviteAccepted(inviteHash, tokenId);
        emit MemberMinted(tokenId, invite.invitee, invite.memberIdHash, invite.relationship);
        emit Locked(tokenId);
    }

    /**
     * @notice 取消邀请（发起方或被邀请方均可取消）
     */
    function cancelInvite(bytes32 inviteHash) external {
        InviteInfo storage invite = _invites[inviteHash];
        if (!invite.active) revert InviteAlreadyUsed();
        if (msg.sender != invite.primaryHolder && msg.sender != invite.invitee)
            revert NotAuthorized();
        invite.active = false;
        emit InviteCancelled(inviteHash);
    }

    // ─────────────────────── 邀请查询接口 ───────────────────

    function getPendingInvite(bytes32 inviteHash) external view returns (InviteInfo memory) {
        return _invites[inviteHash];
    }

    function getInvitesForInvitee(address invitee) external view returns (bytes32[] memory) {
        return _inviteeInvites[invitee];
    }
}