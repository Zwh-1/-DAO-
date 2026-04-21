/**
 * identity.service.js
 * 身份注册与 SBT 中继服务
 *
 * 职责：
 *   - 链上调用 IdentityRegistry：registerCommitment / setLevel / banCommitment / setCommitmentExpiry
 *   - 链上调用 SBT：mint / updateCredit / updateLevel
 *   - 维护白名单 Merkle 树（addLeafToWhitelist）
 *   - DB 持久化身份承诺记录（离线降级模式）
 */

import { ethers } from "ethers";
import { config } from "../config.js";
import { ABIS } from "../abis/index.js";  // 从统一的 ABI 目录导入
import { computeIdentityCommitment } from "./poseidon.service.js";
import { addLeafToWhitelist } from "./merkleTree.service.js";

// ── 链上中继（可选，需配置 RPC_URL + 私钥）──────────────────────────────────

let _provider = null;
let _relayer = null;
let _identityRegistry = null;
let _sbt = null;

function isRelayEnabled() {
    return Boolean(
        config.rpcUrl &&
        config.relayerPrivateKey &&
        config.identityRegistryAddress &&
        config.sbtAddress
    );
}

function getRelayContracts() {
    if (!isRelayEnabled()) return null;
    if (!_provider) {
        _provider = new ethers.JsonRpcProvider(config.rpcUrl);
        _relayer = new ethers.Wallet(config.relayerPrivateKey, _provider);
        // 使用导入的完整 ABI
        _identityRegistry = new ethers.Contract(
            config.identityRegistryAddress,
            ABIS.IdentityRegistry,
            _relayer
        );
        _sbt = new ethers.Contract(config.sbtAddress, ABIS.SBT, _relayer);
    }
    return { identityRegistry: _identityRegistry, sbt: _sbt };
}

// ── 离线降级存储 ─────────────────────────────────────────────────────────────

const _localCommitments = new Map(); // commitment -> { level, banned, expiry, registeredAt }
const _localSbtTokens = new Map();   // address -> { tokenId, commitment, level, creditScore }

// ── 身份承诺注册 ──────────────────────────────────────────────────────────────

/**
 * 注册身份承诺（白名单、链上、Merkle 树三重同步）
 *
 * @param {string} commitment    Poseidon(social_id_hash, secret, trapdoor) 已计算好的承诺值
 * @param {number} level         用户等级（1–5）
 * @returns {{ commitment, level, merkleLeaf, merkleRoot, txHash?, mode }}
 */
export async function registerIdentityCommitment(commitment, level) {
    const commitmentBn = String(BigInt(commitment));

    // 1. 本地记录
    _localCommitments.set(commitmentBn, {
        level,
        banned: false,
        expiry: 0,
        registeredAt: Math.floor(Date.now() / 1000),
    });

    // 2. 更新白名单 Merkle 树
    const { merkleLeaf, merkleRoot } = await addLeafToWhitelist(commitmentBn, level);

    // 3. 链上中继（可选）
    let txHash = null;
    const contracts = getRelayContracts();
    if (contracts) {
        const tx = await contracts.identityRegistry.registerCommitment(
            BigInt(commitmentBn),
            level
        );
        const receipt = await tx.wait();
        txHash = receipt.hash;
    }

    return {
        commitment: commitmentBn,
        level,
        merkleLeaf,
        merkleRoot,
        txHash,
        mode: contracts ? "onchain" : "offchain",
    };
}

/**
 * 辅助函数：从私有见证人计算承诺并注册
 * ⚠️  私有见证人仅在此函数内部使用，不记录日志、不持久化
 */
export async function registerFromWitness(socialIdHash, secret, trapdoor, level) {
    const commitment = await computeIdentityCommitment(socialIdHash, secret, trapdoor);
    return registerIdentityCommitment(commitment, level);
}

// ── 等级管理 ──────────────────────────────────────────────────────────────────

export async function updateCommitmentLevel(commitment, newLevel) {
    const key = String(BigInt(commitment));
    const record = _localCommitments.get(key);
    if (!record) throw Object.assign(new Error("commitment not registered"), { code: "NOT_REGISTERED" });
    record.level = newLevel;

    // 链上中继
    const contracts = getRelayContracts();
    let txHash = null;
    if (contracts) {
        const tx = await contracts.identityRegistry.setLevel(BigInt(key), newLevel);
        const receipt = await tx.wait();
        txHash = receipt.hash;
    }

    return { commitment: key, newLevel, txHash, mode: contracts ? "onchain" : "offchain" };
}

// ── 黑名单 ────────────────────────────────────────────────────────────────────

export async function banIdentityCommitment(commitment, reason) {
    const key = String(BigInt(commitment));
    const record = _localCommitments.get(key);
    if (record) record.banned = true;

    const contracts = getRelayContracts();
    let txHash = null;
    if (contracts) {
        const tx = await contracts.identityRegistry.banCommitment(BigInt(key), reason);
        const receipt = await tx.wait();
        txHash = receipt.hash;
    }

    return { commitment: key, banned: true, reason, txHash, mode: contracts ? "onchain" : "offchain" };
}

// ── 过期管理 ──────────────────────────────────────────────────────────────────

export async function setCommitmentExpiry(commitment, expiryTime) {
    const key = String(BigInt(commitment));
    const record = _localCommitments.get(key);
    if (record) record.expiry = expiryTime;

    const contracts = getRelayContracts();
    let txHash = null;
    if (contracts) {
        const tx = await contracts.identityRegistry.setCommitmentExpiry(BigInt(key), BigInt(expiryTime));
        const receipt = await tx.wait();
        txHash = receipt.hash;
    }

    return { commitment: key, expiryTime, txHash, mode: contracts ? "onchain" : "offchain" };
}

// ── 身份承诺查询 ──────────────────────────────────────────────────────────────

export async function getCommitmentStatus(commitment) {
    const key = String(BigInt(commitment));
    const now = Math.floor(Date.now() / 1000);

    // 优先查链上
    const contracts = getRelayContracts();
    if (contracts) {
        const [registered, blacklisted, level, expiry] = await Promise.all([
            contracts.identityRegistry.registered(BigInt(key)),
            contracts.identityRegistry.blacklisted(BigInt(key)),
            contracts.identityRegistry.levelOf(BigInt(key)),
            contracts.identityRegistry.commitmentExpiry(BigInt(key)),
        ]);
        const expired = expiry > 0n && BigInt(now) > expiry;
        return { commitment: key, registered, blacklisted, level: Number(level), expiry: String(expiry), expired, source: "onchain" };
    }

    // 降级：查本地
    const record = _localCommitments.get(key);
    if (!record) return { commitment: key, registered: false, source: "local" };
    const expired = record.expiry > 0 && now > record.expiry;
    return {
        commitment: key,
        registered: true,
        blacklisted: record.banned,
        level: record.level,
        expiry: record.expiry,
        expired,
        source: "local",
    };
}

// ── SBT 铸造与管理 ───────────────────────────────────────────────────────────

/**
 * 铸造 SBT（需身份承诺已在 IdentityRegistry 注册）
 * @param {string} holderAddress  持有者地址
 * @param {string} commitment     身份承诺（已注册）
 */
export async function mintSBT(holderAddress, commitment) {
    const key = holderAddress.toLowerCase();
    const commitmentBn = BigInt(String(commitment));

    const contracts = getRelayContracts();
    let tokenId = null;
    let txHash = null;

    if (contracts) {
        const tx = await contracts.sbt.mint(key, commitmentBn);
        const receipt = await tx.wait();
        txHash = receipt.hash;
        // 从 Minted 事件解析 tokenId
        const iface = new ethers.Interface(SBT_ABI);
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog(log);
                if (parsed?.name === "Minted") {
                    tokenId = String(parsed.args.tokenId);
                }
            } catch { }
        }
    } else {
        // 离线模式：生成本地 tokenId
        tokenId = String(Date.now());
    }

    _localSbtTokens.set(key, {
        tokenId,
        commitment: String(commitment),
        level: _localCommitments.get(String(commitmentBn))?.level ?? 1,
        creditScore: 650,
    });

    return { address: key, tokenId, commitment: String(commitment), txHash, mode: contracts ? "onchain" : "offchain" };
}

/**
 * 查询 SBT 信息
 */
export async function getSBTInfo(address) {
    const key = address.toLowerCase();

    const contracts = getRelayContracts();
    if (contracts) {
        const tokenId = await contracts.sbt.tokenOf(key);
        if (tokenId === 0n) return { address: key, sbtExists: false };
        const [creditScore, level] = await contracts.sbt.getIdentityScore(key);
        const isEligible = await contracts.sbt.isClaimEligible(key);
        return {
            address: key,
            sbtExists: true,
            tokenId: String(tokenId),
            creditScore: Number(creditScore),
            level: Number(level),
            isClaimEligible: isEligible,
            source: "onchain",
        };
    }

    const record = _localSbtTokens.get(key);
    if (!record) return { address: key, sbtExists: false, source: "local" };
    return { address: key, sbtExists: true, ...record, source: "local" };
}

/**
 * 更新信用分
 */
export async function updateSBTCredit(tokenId, creditScore) {
    if (creditScore < 0 || creditScore > 1000) {
        throw Object.assign(new Error("creditScore must be 0-1000"), { code: "INVALID_CREDIT_SCORE" });
    }

    const contracts = getRelayContracts();
    let txHash = null;
    if (contracts) {
        const tx = await contracts.sbt.updateCredit(BigInt(String(tokenId)), creditScore);
        const receipt = await tx.wait();
        txHash = receipt.hash;
    } else {
        // 离线模式：更新本地 SBT 存储
        for (const [addr, token] of _localSbtTokens.entries()) {
            if (token.tokenId === String(tokenId)) {
                token.creditScore = creditScore;
                break;
            }
        }
    }

    return { tokenId: String(tokenId), creditScore, txHash, mode: contracts ? "onchain" : "offchain" };
}
