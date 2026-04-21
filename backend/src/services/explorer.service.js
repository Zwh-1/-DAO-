/**
 * 区块浏览器数据服务（RPC 直查，MVP）
 *
 * - 依赖 RPC_URL；未配置时返回空数据与 source: "offline"
 * - 不做全链索引；交易列表为近期区块扫描，适合开发网
 */

import { ethers } from "ethers";
import { config } from "../config.js";

const MAX_BLOCK_SCAN = 300;
const MAX_TX_BUFFER = 8000;

function getProvider() {
    if (!config.rpcUrl) return null;
    return new ethers.JsonRpcProvider(config.rpcUrl);
}

function bnToString(n) {
    if (n == null) return "0";
    return typeof n === "bigint" ? n.toString() : String(n);
}

function mapBlock(block) {
    if (!block) return null;
    const txs = block.prefetchedTransactions?.length ?? block.transactions?.length ?? 0;
    return {
        number: block.number,
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: Number(block.timestamp),
        transactionCount: typeof txs === "number" ? txs : 0,
        miner: block.miner,
        gasUsed: bnToString(block.gasUsed),
        gasLimit: bnToString(block.gasLimit),
        difficulty: bnToString(block.difficulty ?? 0n),
        totalDifficulty: bnToString(block.difficulty ?? 0n),
        size: 0,
        nonce: block.nonce != null ? String(block.nonce) : "0x0",
    };
}

async function mapTxResponse(provider, tx, blockTimestamp) {
    const receipt = await provider.getTransactionReceipt(tx.hash).catch(() => null);
    const status =
        receipt == null ? "pending" : receipt.status === 1 ? "success" : "failed";
    const gasUsed = receipt?.gasUsed ?? 0n;
    const effPrice =
        tx.gasPrice ??
        tx.maxFeePerGas ??
        (receipt?.gasPrice ? receipt.gasPrice : 0n);
    const fee =
        typeof gasUsed === "bigint" && typeof effPrice === "bigint"
            ? gasUsed * effPrice
            : 0n;
    return {
        hash: tx.hash,
        blockNumber: tx.blockNumber ?? 0,
        blockHash: tx.blockHash ?? "",
        timestamp: blockTimestamp,
        from: tx.from,
        to: tx.to,
        value: bnToString(tx.value),
        gasPrice: bnToString(tx.gasPrice ?? tx.maxFeePerGas ?? 0n),
        gasUsed: bnToString(gasUsed),
        fee: bnToString(fee),
        nonce: tx.nonce,
        transactionIndex: tx.index ?? 0,
        input: tx.data ?? "0x",
        status,
        methodId: tx.data && tx.data.length >= 10 ? tx.data.slice(0, 10) : undefined,
        methodName: undefined,
    };
}

/**
 * GET /stats
 */
export async function getExplorerStats() {
    const provider = getProvider();
    if (!provider) {
        return {
            totalBlocks: 0,
            totalTransactions: 0,
            totalAddresses: 0,
            latestBlockNumber: 0,
            averageGasPrice: "0",
            tps: 0,
            source: "offline",
        };
    }
    try {
        const latest = await provider.getBlockNumber();
        const feeData = await provider.getFeeData();
        const gasPriceWei = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;

        let recentTxCount = 0;
        const depth = Math.min(40, latest + 1);
        for (let i = 0; i < depth; i++) {
            const b = await provider.getBlock(latest - i, false);
            if (b?.transactions) recentTxCount += b.transactions.length;
        }

        return {
            totalBlocks: latest + 1,
            totalTransactions: recentTxCount,
            totalAddresses: 0,
            latestBlockNumber: latest,
            averageGasPrice: bnToString(gasPriceWei),
            tps: 0,
            source: "rpc",
        };
    } catch {
        return {
            totalBlocks: 0,
            totalTransactions: 0,
            totalAddresses: 0,
            latestBlockNumber: 0,
            averageGasPrice: "0",
            tps: 0,
            source: "error",
        };
    }
}

/**
 * 区块列表（按高度降序）
 */
export async function listBlocks(page, limit) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const provider = getProvider();
    if (!provider) {
        return { data: [], total: 0, page: p, limit: l, totalPages: 1 };
    }
    const latest = await provider.getBlockNumber();
    const offset = (p - 1) * l;
    const total = latest + 1;
    const totalPages = Math.max(1, Math.ceil(total / l));

    const data = [];
    for (let i = 0; i < l; i++) {
        const num = latest - offset - i;
        if (num < 0) break;
        const block = await provider.getBlock(num, false);
        if (block) data.push(mapBlock(block));
    }
    return { data, total, page: p, limit: l, totalPages };
}

export async function getBlockByArg(idOrHash) {
    const provider = getProvider();
    if (!provider) return null;
    const raw = String(idOrHash);
    let block;
    if (/^[0-9]+$/.test(raw)) {
        block = await provider.getBlock(Number(raw), false);
    } else {
        block = await provider.getBlock(raw, false);
    }
    return mapBlock(block);
}

/**
 * 近期交易列表（分页为扫描缓冲区内切片）
 */
export async function listTransactions(page, limit) {
    const provider = getProvider();
    if (!provider) {
        return { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
    }
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(50, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const latest = await provider.getBlockNumber();
    const collected = [];
    outer: for (let bn = latest; bn > Math.max(0, latest - MAX_BLOCK_SCAN); bn--) {
        const block = await provider.getBlock(bn, true);
        if (!block) continue;
        const ts = Number(block.timestamp);
        const raw =
            block.prefetchedTransactions ||
            block.transactions ||
            [];
        for (const item of raw) {
            const tx =
                typeof item === "string"
                    ? await provider.getTransaction(item)
                    : item;
            if (!tx) continue;
            collected.push({ tx, ts });
            if (collected.length >= MAX_TX_BUFFER) break outer;
        }
    }

    if (collected.length === 0) {
        return { data: [], total: 0, page: p, limit: l, totalPages: 1 };
    }

    const window = collected.slice(offset, offset + l);
    const data = [];
    for (const { tx, ts } of window) {
        data.push(await mapTxResponse(provider, tx, ts));
    }

    const hasMore = collected.length > offset + l;
    const total = hasMore ? offset + window.length + 1 : collected.length;
    const totalPages = Math.max(1, Math.ceil(total / l));

    return {
        data,
        total,
        page: p,
        limit: l,
        totalPages,
    };
}

export async function getTransactionByHash(hash) {
    const provider = getProvider();
    if (!provider) return null;
    const tx = await provider.getTransaction(hash);
    if (!tx || tx.blockNumber == null) return null;
    const block = await provider.getBlock(tx.blockNumber, false);
    const ts = block ? Number(block.timestamp) : 0;
    return mapTxResponse(provider, tx, ts);
}

export async function getAddressInfo(address) {
    const provider = getProvider();
    if (!provider) return null;
    let addr;
    try {
        addr = ethers.getAddress(address);
    } catch {
        return null;
    }
    const balance = await provider.getBalance(addr);
    const nonce = await provider.getTransactionCount(addr);
    const code = await provider.getCode(addr);
    return {
        address: addr,
        balance: bnToString(balance),
        transactionCount: nonce,
        isContract: code !== "0x",
    };
}

export async function listAddressTransactions(address, page, limit) {
    const provider = getProvider();
    if (!provider) {
        return { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
    }
    let addr;
    try {
        addr = ethers.getAddress(address);
    } catch {
        return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }

    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(50, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const latest = await provider.getBlockNumber();
    const collected = [];
    outer: for (let bn = latest; bn > Math.max(0, latest - MAX_BLOCK_SCAN); bn--) {
        const block = await provider.getBlock(bn, true);
        if (!block) continue;
        const ts = Number(block.timestamp);
        const raw =
            block.prefetchedTransactions ||
            block.transactions ||
            [];
        for (const item of raw) {
            const tx =
                typeof item === "string"
                    ? await provider.getTransaction(item)
                    : item;
            if (!tx) continue;
            const from = tx.from?.toLowerCase();
            const to = tx.to?.toLowerCase();
            if (from === addr.toLowerCase() || to === addr.toLowerCase()) {
                collected.push({ tx, ts });
                if (collected.length >= MAX_TX_BUFFER) break outer;
            }
        }
    }

    const slice = collected.slice(offset, offset + l);
    const data = [];
    for (const { tx, ts } of slice) {
        data.push(await mapTxResponse(provider, tx, ts));
    }

    const hasMore = collected.length > offset + l;
    const total = hasMore ? offset + data.length + l : collected.length;
    const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / l));

    return {
        data,
        total,
        page: p,
        limit: l,
        totalPages,
    };
}

/**
 * q: 区块号 | 0x64 交易哈希 | 0x40 地址
 */
export async function searchExplorer(qRaw) {
    const provider = getProvider();
    if (!provider) return null;
    const q = String(qRaw || "").trim();
    if (!q) return null;

    if (/^[0-9]+$/.test(q)) {
        const block = await getBlockByArg(q);
        if (block) return { type: "block", result: block };
        return null;
    }

    if (/^0x[a-fA-F0-9]{64}$/.test(q)) {
        const tx = await getTransactionByHash(q);
        if (tx) return { type: "transaction", result: tx };
        const block = await getBlockByArg(q);
        if (block) return { type: "block", result: block };
        return null;
    }

    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
        const info = await getAddressInfo(q);
        if (info) return { type: "address", result: info };
        return null;
    }

    return null;
}
