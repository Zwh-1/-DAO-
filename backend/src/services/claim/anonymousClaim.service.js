/**
 * anonymousClaim.service.js
 * 匿名资金申领服务
 *
 * 对接 AnonymousClaim.sol：
 *   - 验证 anonymous_claim.circom 的 ZK 证明（7 个 public signals）
 *   - 检查 Nullifier 防重放
 *   - 中继链上 AnonymousClaim.claim() 调用
 *
 * Public signals 顺序（与 AnonymousClaim.sol claim() 函数对齐）：
 *   pubSignals[0] = merkle_root
 *   pubSignals[1] = nullifier
 *   pubSignals[2] = commitment
 *   pubSignals[3] = claim_amount
 *   pubSignals[4] = current_timestamp
 *   pubSignals[5] = ts_start
 *   pubSignals[6] = ts_end
 */

import { ethers } from "ethers";
import { config } from "../../config.js";
import { ABIS } from "../../abis/index.js";  // 从统一的 ABI 目录导入

// ── 离线降级：本地已用 nullifier 集合 ────────────────────────────────────────
const _usedNullifiers = new Set();

let _provider = null;
let _relayer = null;
let _contract = null;
let _readOnlyProvider = null;
let _readOnlyContract = null;

function isRelayEnabled() {
    return Boolean(config.rpcUrl && config.relayerPrivateKey && config.anonymousClaimAddress);
}

/** RPC + 合约地址即可读链上状态（无需 RELAYER_PRIVATE_KEY） */
function canReadAnonymousClaimOnChain() {
    return Boolean(
        config.rpcUrl?.trim() &&
        config.anonymousClaimAddress?.trim()
    );
}

function getReadOnlyContract() {
    if (!canReadAnonymousClaimOnChain()) return null;
    if (!_readOnlyContract) {
        _readOnlyProvider = new ethers.JsonRpcProvider(config.rpcUrl);
        _readOnlyContract = new ethers.Contract(
            config.anonymousClaimAddress,
            ABIS.AnonymousClaim,
            _readOnlyProvider
        );
    }
    return _readOnlyContract;
}

/** 链上 AnonymousClaim 中继是否可用（生产环境禁止纯链下申领成功语义时应检查此项） */
export function isAnonymousClaimRelayEnabled() {
    return isRelayEnabled();
}

/** 用于读 status / isNullifierUsed（含仅配置 RPC+地址、未配中继时） */
function getContractForRead() {
    return getContract() || getReadOnlyContract();
}

function getContract() {
    if (!isRelayEnabled()) return null;
    if (!_contract) {
        _provider = new ethers.JsonRpcProvider(config.rpcUrl);
        _relayer = new ethers.Wallet(config.relayerPrivateKey, _provider);
        // 使用导入的完整 ABI
        _contract = new ethers.Contract(config.anonymousClaimAddress, ABIS.AnonymousClaim, _relayer);
    }
    return _contract;
}

// ── 验证 Public Signals 结构 ──────────────────────────────────────────────────

/**
 * 将 snarkjs / 前端传来的 Groth16 证明规范为 ethers 调用 AnonymousClaim.claim 所需的 pA/pB/pC
 */
export function normalizeGroth16ProofForSolidity(proof) {
    if (!proof || typeof proof !== "object") {
        throw Object.assign(new Error("invalid proof"), { code: "INVALID_PROOF" });
    }
    const pi_a = proof.pi_a ?? proof.pA;
    const pi_b = proof.pi_b ?? proof.pB;
    const pi_c = proof.pi_c ?? proof.pC;
    if (!Array.isArray(pi_a) || pi_a.length < 2) {
        throw Object.assign(new Error("proof.pi_a / pA invalid"), { code: "INVALID_PROOF" });
    }
    if (!Array.isArray(pi_b) || !Array.isArray(pi_b[0])) {
        throw Object.assign(new Error("proof.pi_b / pB invalid"), { code: "INVALID_PROOF" });
    }
    if (!Array.isArray(pi_c) || pi_c.length < 2) {
        throw Object.assign(new Error("proof.pi_c / pC invalid"), { code: "INVALID_PROOF" });
    }
    return {
        pA: [BigInt(String(pi_a[0])), BigInt(String(pi_a[1]))],
        pB: [
            [BigInt(String(pi_b[0][0])), BigInt(String(pi_b[0][1]))],
            [BigInt(String(pi_b[1][0])), BigInt(String(pi_b[1][1]))],
        ],
        pC: [BigInt(String(pi_c[0])), BigInt(String(pi_c[1]))],
    };
}

export function validateAnonymousClaimSignals(pubSignals, amount, nullifier) {
    if (!Array.isArray(pubSignals) || pubSignals.length !== 7) {
        return { ok: false, code: 4010, error: "pubSignals must have exactly 7 elements for anonymous_claim" };
    }

    const sigNullifier = String(BigInt(String(pubSignals[1])));
    const sigAmount = String(BigInt(String(pubSignals[3])));

    if (sigNullifier !== String(BigInt(String(nullifier)))) {
        return { ok: false, code: 4011, error: "nullifier mismatch with pubSignals[1]" };
    }
    if (sigAmount !== String(BigInt(String(amount)))) {
        return { ok: false, code: 4012, error: "amount mismatch with pubSignals[3]" };
    }

    return { ok: true };
}

// ── 链上/离线 Nullifier 检查 ─────────────────────────────────────────────────

export async function isNullifierUsed(nullifier) {
    const key = String(BigInt(String(nullifier)));

    // 先查本地缓存（快速路径）
    if (_usedNullifiers.has(key)) return true;

    const contract = getContractForRead();
    if (contract) {
        return contract.isNullifierUsed(BigInt(key));
    }
    return false;
}

// ── 核心：提交匿名申领 ────────────────────────────────────────────────────────

/**
 * 提交匿名申领
 * @param {string} recipient      接收地址
 * @param {string|bigint} amount  申领金额（wei）
 * @param {string|bigint} nullifier
 * @param {object} proof          Groth16 证明 { pA, pB, pC }
 * @param {string[]} pubSignals   7 个 public signals（字符串数组）
 * @returns {{ txHash?, nullifier, amount, mode }}
 */
export async function submitAnonymousClaim(recipient, amount, nullifier, proof, pubSignals) {
    const nullifierKey = String(BigInt(String(nullifier)));

    // 防重放
    if (_usedNullifiers.has(nullifierKey)) {
        throw Object.assign(new Error("Nullifier already used"), { code: "DUPLICATE_NULLIFIER" });
    }

    const contract = getContract();
    let txHash = null;

    if (contract) {
        const { pA, pB, pC } = normalizeGroth16ProofForSolidity(proof);
        const pubSignalsFixed = pubSignals.map((s) => BigInt(String(s)));

        const tx = await contract.claim(
            recipient,
            BigInt(String(amount)),
            BigInt(nullifierKey),
            pA,
            pB,
            pC,
            pubSignalsFixed
        );
        const receipt = await tx.wait();
        txHash = receipt.hash;
    }

    // 记录已使用 nullifier（本地）
    _usedNullifiers.add(nullifierKey);

    return {
        txHash,
        nullifier: nullifierKey,
        amount: String(amount),
        recipient: recipient.toLowerCase(),
        mode: contract ? "onchain" : "offchain",
    };
}

// ── 合约状态查询 ──────────────────────────────────────────────────────────────

export async function getAnonymousClaimStatus() {
    const contract = getContractForRead();
    if (!contract) {
        return {
            address: config.anonymousClaimAddress || null,
            totalBalance: null,
            totalClaimed: null,
            claimCount: null,
            source: "unavailable",
        };
    }

    const [balance, stats, merkleRoot, tsStart, tsEnd] = await Promise.all([
        contract.getBalance(),
        contract.getStats(),
        contract.merkleRoot(),
        contract.tsStart(),
        contract.tsEnd(),
    ]);

    return {
        address: config.anonymousClaimAddress,
        totalBalance: balance.toString(),
        totalClaimed: stats._totalClaimed.toString(),
        claimCount: stats._claimCount.toString(),
        remainingBalance: stats.remaining.toString(),
        merkleRoot: merkleRoot.toString(),
        tsStart: tsStart.toString(),
        tsEnd: tsEnd.toString(),
        source: "onchain",
    };
}

// ── 管理员向合约存款 ──────────────────────────────────────────────────────────

export async function fundAnonymousClaimContract(amountWei) {
    const contract = getContract();
    if (!contract) {
        throw Object.assign(new Error("onchain relay not configured"), { code: "RELAY_DISABLED" });
    }
    const tx = await contract.fund({ value: BigInt(String(amountWei)) });
    const receipt = await tx.wait();
    return { txHash: receipt.hash, amount: String(amountWei) };
}
