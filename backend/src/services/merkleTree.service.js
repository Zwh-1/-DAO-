/**
 * merkleTree.service.js
 * IMT（增量 Merkle 树）管理服务
 *
 * 维护三棵深度 20 的 Poseidon 哈希 Merkle 树：
 *   1. 白名单树  — 存储 merkle_leaf = Poseidon(identity_commitment, user_level)
 *                 供 AntiSybilVerifier 电路使用（merkleLevels=20）
 *   2. 历史行为树 — 存储 history_hash = Poseidon(history_data)
 *                 供 HistoryAnchor 电路使用（merkleLevels=20）
 *   3. 匿名申领树 — 叶子 = anonymous_claim.circom 中的 commitment = Poseidon(secret, nullifier)
 *                 与 AnonymousClaim.sol 中 immutable merkleRoot 对齐（链下生成路径时需与部署根一致）
 *
 * 安全说明：
 *   - 树根（root）持久存储于 DB，可供链上合约验证
 *   - 树状态仅存内存；生产环境应在启动时从 DB 重建
 */

import { buildPoseidon } from "circomlibjs";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { poseidonHash, computeMerkleLeaf, computeHistoryHash } from "./poseidon.service.js";

const MERKLE_DEPTH = 20;

// ── Poseidon 适配器（IMT 需要同步哈希函数）─────────────────────────────────
// 注：circomlibjs buildPoseidon 是异步的，IMT 需要同步，故我们在首次调用前初始化

let _poseidon = null;

async function ensurePoseidon() {
    if (!_poseidon) {
        const poseidonFn = await buildPoseidon();
        _poseidon = (inputs) => {
            const r = poseidonFn(inputs.map(BigInt));
            return poseidonFn.F.toObject(r);
        };
    }
    return _poseidon;
}

// ── 树实例 ────────────────────────────────────────────────────────────────────

/** @type {IncrementalMerkleTree | null} */
let _whitelistTree = null;
/** @type {Map<string, number>} commitment_level => leafIndex */
const _whitelistLeafIndex = new Map();

/** @type {IncrementalMerkleTree | null} */
let _historyTree = null;
/** @type {Map<string, number>} historyHash => leafIndex */
const _historyLeafIndex = new Map();

/** @type {IncrementalMerkleTree | null} */
let _anonymousClaimTree = null;
/** @type {Map<string, number>} commitment (十进制字符串) => leafIndex */
const _anonymousClaimLeafIndex = new Map();

// ── 初始化 ────────────────────────────────────────────────────────────────────

async function getWhitelistTree() {
    if (!_whitelistTree) {
        const p = await ensurePoseidon();
        // IMT 使用同步 Poseidon；ZeroValue = 0n
        _whitelistTree = new IncrementalMerkleTree(p, MERKLE_DEPTH, BigInt(0), 2);
    }
    return _whitelistTree;
}

async function getHistoryTree() {
    if (!_historyTree) {
        const p = await ensurePoseidon();
        _historyTree = new IncrementalMerkleTree(p, MERKLE_DEPTH, BigInt(0), 2);
    }
    return _historyTree;
}

async function getAnonymousClaimTree() {
    if (!_anonymousClaimTree) {
        const p = await ensurePoseidon();
        _anonymousClaimTree = new IncrementalMerkleTree(p, MERKLE_DEPTH, BigInt(0), 2);
    }
    return _anonymousClaimTree;
}

// ── 白名单树操作 ──────────────────────────────────────────────────────────────

/**
 * 向白名单树插入叶子节点
 * leaf = Poseidon(identity_commitment, user_level)
 *
 * @param {string|bigint} identityCommitment  身份承诺
 * @param {number} userLevel                 用户等级
 * @returns {{ leafIndex: number, merkleRoot: string, merkleLeaf: string }}
 */
export async function addLeafToWhitelist(identityCommitment, userLevel) {
    const leaf = await computeMerkleLeaf(identityCommitment, userLevel);
    const leafBig = BigInt(leaf);

    const tree = await getWhitelistTree();
    tree.insert(leafBig);

    const leafIndex = tree.leaves.length - 1;
    const key = `${identityCommitment}:${userLevel}`;
    _whitelistLeafIndex.set(key, leafIndex);

    return {
        leafIndex,
        merkleRoot: String(tree.root),
        merkleLeaf: leaf,
    };
}

/**
 * 获取白名单 Merkle 证明（用于生成 ZK 证明的私有输入）
 *
 * @param {string|bigint} identityCommitment
 * @param {number} userLevel
 * @returns {{ pathElements: string[], pathIndex: number[], root: string, leaf: string } | null}
 */
export async function getWhitelistProof(identityCommitment, userLevel) {
    const key = `${identityCommitment}:${userLevel}`;
    const leafIndex = _whitelistLeafIndex.get(key);
    if (leafIndex === undefined) return null;

    const tree = await getWhitelistTree();
    const proof = tree.createProof(leafIndex);

    return {
        leafIndex,
        pathElements: proof.siblings.map((s) => String(s[0])),
        pathIndices: proof.pathIndices,
        root: String(proof.root),
        leaf: String(proof.leaf),
    };
}

/**
 * 获取当前白名单 Merkle 根
 */
export async function getWhitelistRoot() {
    const tree = await getWhitelistTree();
    return String(tree.root);
}

/**
 * 查询某 identityCommitment+level 是否在白名单中
 */
export function isInWhitelist(identityCommitment, userLevel) {
    const key = `${identityCommitment}:${userLevel}`;
    return _whitelistLeafIndex.has(key);
}

// ── 历史行为树操作 ────────────────────────────────────────────────────────────

/**
 * 将历史行为数据插入历史树
 * leaf = history_hash = Poseidon(history_data)
 *
 * @param {string|bigint} historyData  历史行为原始数据（私有，不建议原样存储）
 * @returns {{ leafIndex: number, merkleRoot: string, historyHash: string }}
 */
export async function addLeafToHistoryTree(historyData) {
    const historyHash = await computeHistoryHash(historyData);
    const leafBig = BigInt(historyHash);

    const tree = await getHistoryTree();
    tree.insert(leafBig);

    const leafIndex = tree.leaves.length - 1;
    _historyLeafIndex.set(historyHash, leafIndex);

    return {
        leafIndex,
        merkleRoot: String(tree.root),
        historyHash,
    };
}

/**
 * 获取历史行为 Merkle 证明
 * @param {string|bigint} historyData
 * @returns {{ pathElements: string[], pathIndex: number[], root: string, historyHash: string } | null}
 */
export async function getHistoryProof(historyData) {
    const historyHash = await computeHistoryHash(historyData);
    const leafIndex = _historyLeafIndex.get(historyHash);
    if (leafIndex === undefined) return null;

    const tree = await getHistoryTree();
    const proof = tree.createProof(leafIndex);

    return {
        pathElements: proof.siblings.map((s) => String(s[0])),
        pathIndex: proof.pathIndices,
        root: String(proof.root),
        historyHash,
    };
}

/**
 * 获取当前历史行为 Merkle 根
 */
export async function getHistoryRoot() {
    const tree = await getHistoryTree();
    return String(tree.root);
}

// ── 匿名申领树（与 anonymous_claim.circom 中 commitment 叶子一致）────────────────

/**
 * 注册 commitment 叶子（用户事先将链下计算得到的 commitment 提交到服务端以生成 Merkle 路径）
 * @param {string|bigint} commitment  与电路中 Poseidon(secret, nullifier) 输出一致
 * @returns {{ leafIndex: number, merkleRoot: string, alreadyExists: boolean }}
 */
export async function addAnonymousClaimLeaf(commitment) {
    const c = BigInt(String(commitment));
    const key = String(c);
    const tree = await getAnonymousClaimTree();
    if (_anonymousClaimLeafIndex.has(key)) {
        return {
            leafIndex: _anonymousClaimLeafIndex.get(key),
            merkleRoot: String(tree.root),
            alreadyExists: true,
        };
    }
    tree.insert(c);
    const leafIndex = tree.leaves.length - 1;
    _anonymousClaimLeafIndex.set(key, leafIndex);
    return {
        leafIndex,
        merkleRoot: String(tree.root),
        alreadyExists: false,
    };
}

/**
 * 获取匿名申领 Merkle 证明（私有 witness：merkle_path + leaf_index）
 * @param {string|bigint} commitment
 * @returns {{ leafIndex: number, pathElements: string[], pathIndices: number[], root: string, leaf: string } | null}
 */
export async function getAnonymousClaimMerkleProof(commitment) {
    const key = String(BigInt(String(commitment)));
    const leafIndex = _anonymousClaimLeafIndex.get(key);
    if (leafIndex === undefined) return null;

    const tree = await getAnonymousClaimTree();
    const proof = tree.createProof(leafIndex);

    return {
        leafIndex,
        pathElements: proof.siblings.map((s) => String(s[0])),
        pathIndices: proof.pathIndices,
        root: String(proof.root),
        leaf: String(proof.leaf),
    };
}

/**
 * 当前匿名申领树根（须与链上 AnonymousClaim.merkleRoot 一致方可验链；部署时需对齐）
 */
export async function getAnonymousClaimMerkleRoot() {
    const tree = await getAnonymousClaimTree();
    return String(tree.root);
}

/**
 * 从 DB 批量重建匿名申领树（服务启动时可选）
 * @param {Array<{ commitment: string | bigint }>} rows
 */
export async function rebuildAnonymousClaimTree(rows) {
    _anonymousClaimTree = null;
    _anonymousClaimLeafIndex.clear();
    for (const row of rows) {
        await addAnonymousClaimLeaf(row.commitment);
    }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 从 DB 批量重建白名单树（服务启动时调用）
 * @param {Array<{identityCommitment: string, userLevel: number}>} rows
 */
export async function rebuildWhitelistTree(rows) {
    // 重置
    _whitelistTree = null;
    _whitelistLeafIndex.clear();
    for (const row of rows) {
        await addLeafToWhitelist(row.identityCommitment, row.userLevel);
    }
}

/**
 * 从 DB 批量重建历史行为树（服务启动时调用）
 * @param {Array<{historyData: string}>} rows
 */
export async function rebuildHistoryTree(rows) {
    _historyTree = null;
    _historyLeafIndex.clear();
    for (const row of rows) {
        await addLeafToHistoryTree(row.historyData);
    }
}
