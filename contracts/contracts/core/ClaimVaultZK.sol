// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../verifiers/IAntiSybilGroth16Verifier.sol";
import "./IdentityRegistry.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

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
    error MerkleRootMismatch();
    error ParameterHashMismatch();
    error InvalidUserLevel();
    error BadPublicSignalCount();

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

    IAntiSybilGroth16Verifier public immutable verifier;
    IdentityRegistry public immutable registry;

    /// @notice 白名单 Merkle 根，须与 `pubSignals[0]` 一致
    uint256 public immutable expectedMerkleRoot;

    /// @notice Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)，须与 `pubSignals[6]` 一致
    uint256 public immutable expectedParameterHash;

    /// @notice EIP-712 Claim 绑定用项目 ID（与电路私有输入 airdrop_project_id 一致）
    uint256 public immutable airdropProjectId;

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
        uint256 maxAmount,
        uint256 expectedMerkleRoot_,
        uint256 expectedParameterHash_,
        uint256 airdropProjectId_
    ) {
        verifier = IAntiSybilGroth16Verifier(verifier_);
        registry = IdentityRegistry(registry_);
        minClaimAmount = minAmount;
        maxClaimAmount = maxAmount;
        expectedMerkleRoot = expectedMerkleRoot_;
        expectedParameterHash = expectedParameterHash_;
        airdropProjectId = airdropProjectId_;
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

    /// @notice pubSignals 与 `anti_sybil_verifier.circom` 的 public 输出严格对齐（共 8 个）：
    /// [0] merkle_root
    /// [1] identity_commitment
    /// [2] nullifier_hash
    /// [3] user_level
    /// [4] claim_amount
    /// [5] claim_ts
    /// [6] parameter_hash  — Poseidon(min_level, min_amount, max_amount, ts_start, ts_end, airdrop_project_id)
    /// [7] merkle_leaf
    function claimAirdrop(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata pubSignals,
        bytes calldata signature  // ✅ EIP-712 签名（防跨链重放）
    ) external nonReentrant {
        if (paused) revert Paused();
        if (pubSignals.length != 8) revert BadPublicSignalCount();

        uint256[8] memory pub8;
        for (uint256 i = 0; i < 8; ) {
            pub8[i] = pubSignals[i];
            unchecked {
                ++i;
            }
        }

        if (!verifier.verifyProof(a, b, c, pub8)) revert InvalidProof();

        uint256 merkleRoot = pub8[0];
        uint256 identityCommitment = pub8[1];
        uint256 nullifier = pub8[2];
        uint256 userLevel = pub8[3];
        uint256 claimAmount = pub8[4];
        uint256 claimTs = pub8[5];
        uint256 parameterHash = pub8[6];

        if (merkleRoot != expectedMerkleRoot) revert MerkleRootMismatch();
        if (parameterHash != expectedParameterHash) revert ParameterHashMismatch();

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

        // ── 验证 4: 申领时间不晚于链上时间（电路已约束 ts 窗口并绑定 parameter_hash）
        if (claimTs > block.timestamp) revert InvalidClaimAmount();

        // ── 验证 5: 身份注册表等级与公开 user_level 一致（与 Merkle 叶子一致）
        if (uint256(registry.levelOf(identityCommitment)) != userLevel) revert InvalidUserLevel();

        // ── 验证 6: ✅ 强制检查身份承诺状态（抛出错误代码）──────────────
        registry.checkCommitmentStatus(identityCommitment);

        // ── 验证 7: ✅ 验证 EIP-712 签名（包含 chainid，防止跨链重放）──
        _verifyClaimSignature(msg.sender, nullifier, identityCommitment, airdropProjectId, signature);

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
    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert SignatureLengthInvalid();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v != 27 && v != 28) revert InvalidSignature();
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidSignature();
        return recovered;
    }
}
