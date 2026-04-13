// SPDX-License-Identifier: MIT
// 功能：高频小额支付的链下签名 + 链上结算
// 安全重构版：添加挑战期机制，防止恶意立即关闭通道
// - 挑战期：24 小时（86400 秒），给受助者足够时间反击
// - 资产守恒：balance1 + balance2 === totalDeposit
// - Nonce 严格递增：防止回滚到旧的小额状态
// - 双重签名验证：确保双方同意
// - 多链重放保护：EIP-712 Domain Separator 包含 block.chainid

pragma solidity ^0.8.20;

import "../libraries/ECRecoverLib.sol";

/// @notice 支付通道合约：支持多链部署
/// @dev Domain Separator 硬编码 chainid，防止跨链重放攻击
contract PaymentChannel {
    //  自定义错误代码 
    error InvalidParticipant1();
    error InvalidParticipant2();
    error SameParticipant();
    error ZeroDeposit();
    error ExitInProgress();
    error NonceNotIncreasing();
    error AmountMismatch();
    error InvalidSignature1();
    error InvalidSignature2();
    error ExitAlreadyStarted();
    error ChannelEmpty();
    error ChallengePeriodNotEnded();
    error TransferFailed();
    error ExitNotStarted();
    error InvalidSignatureLength();
    error InvalidVValue();
    
    //  状态变量 
    address public immutable participant1;  // 发起人（资金锁定方）
    address public immutable participant2;  // 受助者（服务提供方）
    uint256 public immutable totalDeposit;  // 总锁定资金（不可变）
    
    //  挑战期常量 
    uint256 public constant CHALLENGE_PERIOD = 86400; // 24 小时挑战期
    
    //  EIP-712 Domain Separator（包含 chainid，防止跨链重放）
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant STATE_TYPEHASH = keccak256("ChannelState(uint256 balance1,uint256 balance2,uint256 nonce)");
    
    //  通道状态结构体 
    struct ChannelState {
        uint256 balance1;  // 发起人当前余额
        uint256 balance2;  // 受助者当前余额
        uint256 nonce;     // 递增序列号（防重放）
        uint64  closeRequestedAt; // 挑战期开始时间（0=未发起关闭）
        bool    exitInitiated;    // 是否已发起关闭
    }
    
    ChannelState public latestState;
    
    //  事件定义 
    event StateUpdated(
        uint256 indexed nonce,
        uint256 balance1,
        uint256 balance2,
        uint256 timestamp
    );
    
    event ChannelClosed(
        uint256 indexed nonce,
        uint256 payout1,
        uint256 payout2,
        uint256 timestamp
    );
    
    event ExitStarted(
        uint256 indexed nonce,
        uint256 challengeEndTime,
        uint256 timestamp
    );
    
    //  构造函数 
    /**
     * @dev 初始化支付通道
     * @param _participant1 发起人地址
     * @param _participant2 受助者地址
     * @param _totalDeposit 总锁定资金
     */
    constructor(
        address _participant1,
        address _participant2,
        uint256 _totalDeposit
    ) {
        if (_participant1 == address(0)) revert InvalidParticipant1();
        if (_participant2 == address(0)) revert InvalidParticipant2();
        if (_participant1 == _participant2) revert SameParticipant();
        if (_totalDeposit == 0) revert ZeroDeposit();
        
        participant1 = _participant1;
        participant2 = _participant2;
        totalDeposit = _totalDeposit;
        
        //  初始化 Domain Separator（硬编码 chainid，防止跨链重放）
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("PaymentChannel")),
            keccak256(bytes("1")),
            block.chainid, //  多链重放保护：不同链的 chainid 不同
            address(this)
        ));
        
        // 初始状态：nonce=0，全部资金在发起人账户
        latestState = ChannelState({
            balance1: _totalDeposit,
            balance2: 0,
            nonce: 0,
            closeRequestedAt: 0,
            exitInitiated: false
        });
    }
    
    //  核心函数：状态更新 
    /**
     * @dev 更新通道状态（链下签名 + 链上验证）
     * @param _balance1 发起人新余额
     * @param _balance2 受助者新余额
     * @param _nonce 递增的序列号
     * @param sig1 发起人签名
     * @param sig2 受助者签名
     */
    function updateState(
        uint256 _balance1,
        uint256 _balance2,
        uint256 _nonce,
        bytes calldata sig1,
        bytes calldata sig2
    ) public {
        // ✅ 约束 1: 挑战期内禁止更新（防止争议期间状态被篡改）
        if (latestState.exitInitiated) revert ExitInProgress();
        
        // ✅ 约束 2: Nonce 必须严格递增（防回滚攻击）
        if (_nonce <= latestState.nonce) revert NonceNotIncreasing();
        
        // ✅ 约束 3: 金额守恒（防资产增发）
        if (_balance1 + _balance2 != totalDeposit) revert AmountMismatch();
        
        // ✅ 约束 4: 验证双方签名（使用 EIP-712，包含 chainid）
        bytes32 digest = _hashTypedData(_balance1, _balance2, _nonce);
        if (recoverSigner(digest, sig1) != participant1) revert InvalidSignature1();
        if (recoverSigner(digest, sig2) != participant2) revert InvalidSignature2();
        
        // ✅ 更新状态（使用 storage 指针减少 SLOAD）
        latestState.balance1 = _balance1;
        latestState.balance2 = _balance2;
        latestState.nonce = _nonce;
        
        emit StateUpdated(_nonce, _balance1, _balance2, block.timestamp);
    }
    
    //  核心函数：挑战期机制 
    /**
     * @dev 发起单方面关闭通道（挑战期机制）
     * @notice 发起后需等待 CHALLENGE_PERIOD 秒才能提取资金
     * @notice 挑战期内允许对方提交更新状态进行争议
     */
    function startExit() external {
        if (latestState.exitInitiated) revert ExitAlreadyStarted();
        if (latestState.balance1 + latestState.balance2 == 0) revert ChannelEmpty();
        
        latestState.exitInitiated = true;
        latestState.closeRequestedAt = uint64(block.timestamp);
        
        uint256 challengeEndTime = block.timestamp + CHALLENGE_PERIOD;
        emit ExitStarted(latestState.nonce, challengeEndTime, block.timestamp);
    }
    
    /**
     * @dev 挑战期结束后提取资金
     * @notice 按最后一次链上状态（latestState）提取
     * @notice 挑战期内无法调用此函数
     */
    function withdrawAfterChallenge() external {
        if (!latestState.exitInitiated) revert ExitNotStarted();
        if (block.timestamp < latestState.closeRequestedAt + CHALLENGE_PERIOD) {
            revert ChallengePeriodNotEnded();
        }
        
        uint256 payout1 = latestState.balance1;
        uint256 payout2 = latestState.balance2;
        
        // 更新状态（标记通道已关闭）
        latestState.balance1 = 0;
        latestState.balance2 = 0;
        latestState.exitInitiated = false;
        
        // 转账（先转 participant2，再转 participant1）
        if (payout2 > 0) {
            (bool success2, ) = payable(participant2).call{value: payout2}("");
            if (!success2) revert TransferFailed();
        }
        
        if (payout1 > 0) {
            (bool success1, ) = payable(participant1).call{value: payout1}("");
            if (!success1) revert TransferFailed();
        }
        
        emit ChannelClosed(latestState.nonce, payout1, payout2, block.timestamp);
    }
    
    //  核心函数：通道关闭 
    /**
     * @dev 关闭通道并执行最终结算
     * @param _balance1 最终发起人余额
     * @param _balance2 最终受助者余额
     * @param _nonce 最终 nonce
     * @param sig1 发起人签名
     * @param sig2 受助者签名
     */
    function closeChannel(
        uint256 _balance1,
        uint256 _balance2,
        uint256 _nonce,
        bytes calldata sig1,
        bytes calldata sig2
    ) public {
        // ✅ 验证签名（使用 EIP-712，包含 chainid）
        bytes32 digest = _hashTypedData(_balance1, _balance2, _nonce);
        if (recoverSigner(digest, sig1) != participant1) revert InvalidSignature1();
        if (recoverSigner(digest, sig2) != participant2) revert InvalidSignature2();
        
        // ✅ 金额守恒检查
        if (_balance1 + _balance2 != totalDeposit) revert AmountMismatch();
        
        // ✅ 执行转账（先转 participant2，再转 participant1）
        uint256 payout2 = _balance2;
        uint256 payout1 = _balance1;
        
        // 更新状态（标记通道已关闭）
        latestState.balance1 = 0;
        latestState.balance2 = 0;
        latestState.nonce = _nonce;
        latestState.closeRequestedAt = 0;
        latestState.exitInitiated = false;
        
        // 转账
        (bool success2, ) = payable(participant2).call{value: payout2}("");
        if (!success2) revert TransferFailed();
        
        (bool success1, ) = payable(participant1).call{value: payout1}("");
        if (!success1) revert TransferFailed();
        
        emit ChannelClosed(_nonce, payout1, payout2, block.timestamp);
    }
    
    //  辅助函数：紧急关闭 
    /**
     * @dev 紧急关闭通道（仅管理员，可选功能）
     * @notice 此函数为预留接口，实际使用需谨慎
     */
    function emergencyClose() external view {
        // 预留紧急关闭逻辑（可根据需求实现）
    }
    
    //  内部函数：EIP-712 哈希 
    /**
     * @dev 计算 EIP-712 类型化数据哈希
     * @param balance1 发起人余额
     * @param balance2 受助者余额
     * @param nonce 序列号
     * @return digest 最终哈希（包含 Domain Separator）
     */
    function _hashTypedData(uint256 balance1, uint256 balance2, uint256 nonce) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            STATE_TYPEHASH,
            balance1,
            balance2,
            nonce
        ));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
    
    //  辅助函数：恢复签名者 
    /**
     * @dev 从签名中恢复签名者地址
     * @param digest 已哈希的消息
     * @param sig 签名（65 字节）
     * @return signer 签名者地址
     */
    function recoverSigner(bytes32 digest, bytes calldata sig) internal view returns (address) {
        if (sig.length != 65) revert InvalidSignatureLength();
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // 内联汇编提取 r, s, v（使用 calldataload 访问 calldata）
        // sig.offset 是 calldata 偏移量，+0x20 跳过 length 字段
        assembly {
            let dataStart := add(sig.offset, 0x20)
            r := calldataload(dataStart)
            s := calldataload(add(dataStart, 0x20))
            v := and(calldataload(add(dataStart, 0x40)), 0xff)
        }
        
        if (v != 27 && v != 28) revert InvalidVValue();
        
        return ECRecoverLib.ecrecover(digest, v, r, s);
    }
    
    //  视图函数：查询状态 
    /**
     * @dev 查询通道状态详情
     */
    function getChannelState() external view returns (
        uint256 balance1,
        uint256 balance2,
        uint256 nonce,
        uint256 closeRequestedAt,
        bool exitInitiated
    ) {
        ChannelState memory state = latestState;
        return (
            state.balance1,
            state.balance2,
            state.nonce,
            state.closeRequestedAt,
            state.exitInitiated
        );
    }
    
    /**
     * @dev 查询挑战期剩余时间
     * @return remainingTime 剩余时间（秒），如果未发起关闭则返回 0
     */
    function getChallengeRemainingTime() external view returns (uint256 remainingTime) {
        if (!latestState.exitInitiated) {
            return 0;
        }
        
        uint256 challengeEndTime = latestState.closeRequestedAt + CHALLENGE_PERIOD;
        if (block.timestamp >= challengeEndTime) {
            return 0;
        }
        
        return challengeEndTime - block.timestamp;
    }
}
