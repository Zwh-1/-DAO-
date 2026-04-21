/**
 * eip712.service.js
 * EIP-712 签名生成与验证工具
 *
 * 用途：
 *   1. Relayer 为 ClaimVaultZK.claimAirdrop 生成 EIP-712 签名
 *      Domain: ClaimVaultZK, CLAIM_TYPEHASH: Claim(uint256 nullifier,uint256 identityCommitment,uint256 projectId)
 *   2. PaymentChannel 状态签名
 *      Domain: PaymentChannel, STATE_TYPEHASH: ChannelState(uint256 balance1,uint256 balance2,uint256 nonce)
 */

import { ethers } from "ethers";

// ── ClaimVaultZK EIP-712 ──────────────────────────────────────────────────────

const CLAIM_TYPES = {
    Claim: [
        { name: "nullifier", type: "uint256" },
        { name: "identityCommitment", type: "uint256" },
        { name: "projectId", type: "uint256" },
    ],
};

const CLAIM_VAULT_DOMAIN_NAME = "ClaimVaultZK";
const CLAIM_VAULT_VERSION = "1";

/**
 * 构建 ClaimVaultZK EIP-712 Domain
 * @param {string} contractAddress  ClaimVaultZK 合约地址
 * @param {number|bigint} chainId   链 ID
 */
function buildClaimDomain(contractAddress, chainId) {
    return {
        name: CLAIM_VAULT_DOMAIN_NAME,
        version: CLAIM_VAULT_VERSION,
        chainId: Number(chainId),
        verifyingContract: contractAddress,
    };
}

/**
 * 生成 ClaimVaultZK 申领签名（Relayer 或用户自签）
 * @param {string|bigint} nullifier              Nullifier（十进制字符串）
 * @param {string|bigint} identityCommitment     身份承诺
 * @param {string|bigint} projectId              项目 ID
 * @param {string} contractAddress               ClaimVaultZK 合约地址
 * @param {number|bigint} chainId                链 ID
 * @param {string} signerPrivateKey              签名者私钥
 * @returns {Promise<string>} 65 字节 EIP-712 签名（0x 前缀）
 */
export async function signClaimData(
    nullifier,
    identityCommitment,
    projectId,
    contractAddress,
    chainId,
    signerPrivateKey
) {
    const wallet = new ethers.Wallet(signerPrivateKey);
    const domain = buildClaimDomain(contractAddress, chainId);
    const message = {
        nullifier: BigInt(String(nullifier)),
        identityCommitment: BigInt(String(identityCommitment)),
        projectId: BigInt(String(projectId)),
    };
    const signature = await wallet.signTypedData(domain, CLAIM_TYPES, message);
    return signature;
}

/**
 * 验证 ClaimVaultZK EIP-712 签名
 * @param {string} claimant               申领者地址
 * @param {string|bigint} nullifier
 * @param {string|bigint} identityCommitment
 * @param {string|bigint} projectId
 * @param {string} signature              65 字节签名
 * @param {string} contractAddress
 * @param {number|bigint} chainId
 * @returns {boolean}
 */
export function verifyClaimSignature(
    claimant,
    nullifier,
    identityCommitment,
    projectId,
    signature,
    contractAddress,
    chainId
) {
    const domain = buildClaimDomain(contractAddress, chainId);
    const message = {
        nullifier: BigInt(String(nullifier)),
        identityCommitment: BigInt(String(identityCommitment)),
        projectId: BigInt(String(projectId)),
    };
    const recovered = ethers.verifyTypedData(domain, CLAIM_TYPES, message, signature);
    return recovered.toLowerCase() === claimant.toLowerCase();
}

// ── PaymentChannel EIP-712 ────────────────────────────────────────────────────

const CHANNEL_STATE_TYPES = {
    ChannelState: [
        { name: "balance1", type: "uint256" },
        { name: "balance2", type: "uint256" },
        { name: "nonce", type: "uint256" },
    ],
};

const PAYMENT_CHANNEL_DOMAIN_NAME = "PaymentChannel";
const PAYMENT_CHANNEL_VERSION = "1";

function buildChannelDomain(contractAddress, chainId) {
    return {
        name: PAYMENT_CHANNEL_DOMAIN_NAME,
        version: PAYMENT_CHANNEL_VERSION,
        chainId: Number(chainId),
        verifyingContract: contractAddress,
    };
}

/**
 * 生成 PaymentChannel 状态签名（双方各自签名）
 * @param {bigint|string} balance1          发起人余额
 * @param {bigint|string} balance2          受助者余额
 * @param {bigint|number} nonce             序列号
 * @param {string} contractAddress          PaymentChannel 合约地址
 * @param {number|bigint} chainId
 * @param {string} signerPrivateKey         签名者私钥
 * @returns {Promise<string>}
 */
export async function signChannelState(
    balance1,
    balance2,
    nonce,
    contractAddress,
    chainId,
    signerPrivateKey
) {
    const wallet = new ethers.Wallet(signerPrivateKey);
    const domain = buildChannelDomain(contractAddress, chainId);
    const message = {
        balance1: BigInt(String(balance1)),
        balance2: BigInt(String(balance2)),
        nonce: BigInt(String(nonce)),
    };
    return wallet.signTypedData(domain, CHANNEL_STATE_TYPES, message);
}

/**
 * 验证 PaymentChannel 状态签名
 * @param {string} expectedSigner           预期签名者地址
 * @param {bigint|string} balance1
 * @param {bigint|string} balance2
 * @param {bigint|number} nonce
 * @param {string} signature
 * @param {string} contractAddress
 * @param {number|bigint} chainId
 * @returns {boolean}
 */
export function verifyChannelStateSignature(
    expectedSigner,
    balance1,
    balance2,
    nonce,
    signature,
    contractAddress,
    chainId
) {
    const domain = buildChannelDomain(contractAddress, chainId);
    const message = {
        balance1: BigInt(String(balance1)),
        balance2: BigInt(String(balance2)),
        nonce: BigInt(String(nonce)),
    };
    const recovered = ethers.verifyTypedData(domain, CHANNEL_STATE_TYPES, message, signature);
    return recovered.toLowerCase() === expectedSigner.toLowerCase();
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 恢复 EIP-712 签名的签名者地址（通用）
 * @param {object} domain
 * @param {object} types
 * @param {object} message
 * @param {string} signature
 * @returns {string} 小写地址
 */
export function recoverTypedDataSigner(domain, types, message, signature) {
    return ethers.verifyTypedData(domain, types, message, signature).toLowerCase();
}
