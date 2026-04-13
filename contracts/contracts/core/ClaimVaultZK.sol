// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../verifiers/IGroth16Verifier.sol";
import "./IdentityRegistry.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../libraries/ECRecoverLib.sol";

/// @dev ZK 申领入口：合约层二次校验金额 + Nullifier 防重放（与电路约束双保险）
/// @notice 安全重构版：添加多链重放保护（EIP-712 Domain Separator）
/// @notice 多链兼容：支持以太坊主网、Arbitrum、Optimism 等
contract ClaimVaultZK is ReentrancyGuard {
    // ✅ 自定义错误代码
    error NullifierAlreadyUsed();
    error InvalidClaimAmount();
    error InvalidProof();
    error Paused();
    error InsufficientBalance();
    error TransferFailed();
    error InvalidSignature();
    error SignatureLengthInvalid();

    // 事件定义
    event ClaimAirdropped(
        uint256 indexed nullifier,
        address indexed claimant,
        uint256 amount,
        uint256 identityCommitment
    );
    
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ✅ EIP-712 Domain Separator（包含 chainid，防止跨链重放）
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(uint256 nullifier,uint256 identityCommitment,uint256 projectId)");

    IGroth16Verifier public immutable verifier;
    IdentityRegistry public immutable registry;

    // ✅ 修复：usedNullifiers 映射键类型从 bytes32 改为 uint256
    mapping(uint256 => bool) public usedNullifiers;

    uint256 public immutable minClaimAmount;
    uint256 public immutable maxClaimAmount;

    bool public paused;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(
        address verifier_,
        address registry_,
        uint256 minAmount,
        uint256 maxAmount
    ) {
        verifier = IGroth16Verifier(verifier_);
        registry = IdentityRegistry(registry_);
        minClaimAmount = minAmount;
        maxClaimAmount = maxAmount;
        owner = msg.sender;
        
        // ✅ 初始化 Domain Separator（硬编码 chainid，防止跨链重放）
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("ClaimVaultZK")),
            keccak256(bytes("1")),
            block.chainid, // ✅ 多链重放保护：不同链的 chainid 不同
            address(this)
        ));
    }
    
    /**
     * @dev 接收 ETH 存款（支持直接转账）
     */
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev 显式存款函数（可选）
     */
    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev 管理员提取资金（紧急情况下使用）
     * @notice 仅当合约暂停时可提取，保护用户资金
     */
    function withdraw(uint256 amount, address to) external onlyOwner {
        require(paused, "Not paused");
        require(address(this).balance >= amount, "Insufficient balance");
        
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(to, amount);
    }

    function setPaused(bool v) external onlyOwner {
        paused = v;
    }

    /// @notice pubSignals 与 `anti_sybil_verifier.circom` 的 public 输出严格对齐（共 13 个）：
    /// [0]  merkle_root          - 白名单 Merkle 根
    /// [1]  identity_commitment  - 身份承诺（用于注册表验证）
    /// [2]  nullifier_hash       - 防重放 Nullifier
    /// [3]  min_level            - 最低信誉等级门槛
    /// [4]  user_level           - 用户实际信誉等级
    /// [5]  min_amount           - 最低申领金额
    /// [6]  max_amount           - 最高申领金额
    /// [7]  claim_amount         - 实际申领金额
    /// [8]  claim_ts             - 申领时间戳
    /// [9]  ts_start             - 空投开始时间
    /// [10] ts_end               - 空投结束时间
    /// [11] airdrop_project_id   - 空投项目 ID（防跨项目重放）
    /// [12] merkle_leaf          - Merkle 叶子哈希
    function claimAirdrop(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata pubSignals,
        bytes calldata signature  // ✅ EIP-712 签名（防跨链重放）
    ) external nonReentrant {
        if (paused) revert Paused();
        if (!verifier.verifyProof(a, b, c, pubSignals)) revert InvalidProof();
        require(pubSignals.length == 13, "bad public signals length");

        //  解析 Public Signals（与电路层输出顺序严格一致）
        uint256 identityCommitment = pubSignals[1];
        uint256 nullifier = pubSignals[2];
        uint256 claimAmount = pubSignals[7];
        uint256 claimTs = pubSignals[8];
        uint256 tsStart = pubSignals[9];
        uint256 tsEnd = pubSignals[10];
        uint256 projectId = pubSignals[11];

        // ── 验证 1: Nullifier 防重放 ────────────────────────────────────
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed();

        // ── 验证 2: 余额检查（防止资金不足导致 DoS）────────────────────
        if (address(this).balance < claimAmount) {
            revert InsufficientBalance();
        }

        // ── 验证 3: 金额范围（合约层二次验证）────────────────────────────
        if (claimAmount < minClaimAmount || claimAmount > maxClaimAmount) {
            revert InvalidClaimAmount();
        }

        // ── 验证 4: 时间窗口（合约层二次验证）────────────────────────────
        if (claimTs < tsStart || claimTs > tsEnd) {
            revert InvalidClaimAmount();
        }

        // ── 验证 5: ✅ 强制检查身份承诺状态（抛出错误代码）──────────────
        registry.checkCommitmentStatus(identityCommitment);

        // ── 验证 6: ✅ 验证 EIP-712 签名（包含 chainid，防止跨链重放）──
        _verifyClaimSignature(msg.sender, nullifier, identityCommitment, projectId, signature);

        // ── 记录 Nullifier 已使用 ─────────────────────────────────────
        usedNullifiers[nullifier] = true;

        // ── 执行转账（先更新状态，再转账，遵循 CEI 模式）────────────────
        (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
        if (!success) revert TransferFailed();

        // ── 触发事件（包含完整的审计信息）─────────────────────────────
        emit ClaimAirdropped(
            nullifier,
            msg.sender,
            claimAmount,
            identityCommitment
        );
    }
    
    // ── 内部函数：验证签名 ────────────────────────────────────────────
    /**
     * @dev 验证 EIP-712 签名（包含 chainid，防止跨链重放）
     * @param claimant 申领者地址
     * @param nullifier Nullifier
     * @param identityCommitment 身份承诺
     * @param projectId 项目 ID
     * @param signature EIP-712 签名
     */
    function _verifyClaimSignature(
        address claimant,
        uint256 nullifier,
        uint256 identityCommitment,
        uint256 projectId,
        bytes calldata signature
    ) internal view {
        if (signature.length != 65) revert SignatureLengthInvalid();
        
        // 计算 EIP-712 类型化数据哈希
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            nullifier,
            identityCommitment,
            projectId
        ));
        
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            structHash
        ));
        
        // 恢复签名者地址
        address signer = _recoverSigner(digest, signature);
        
        // 验证签名者必须是申领者本人（或管理员）
        if (signer != claimant && signer != owner) revert InvalidSignature();
    }
    
    // ── 内部函数：恢复签名者 ──────────────────────────────────────────
    /**
     * @dev 从签名中恢复签名者地址
     * @param digest 已哈希的消息
     * @param sig 签名（65 字节）
     * @return signer 签名者地址
     */
    function _recoverSigner(bytes32 digest, bytes calldata sig) internal view returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // 内联汇编提取 r, s, v
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 0x20))
            v := and(calldataload(add(sig.offset, 0x40)), 0xff)
        }
        
        if (v != 27 && v != 28) revert InvalidSignature();
        
        return ECRecoverLib.ecrecover(digest, v, r, s);
    }
}
