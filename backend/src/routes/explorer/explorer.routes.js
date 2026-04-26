/**
 * Explorer 路由 — RPC 直查（MVP）
 * 前缀：/v1/explorer
 */

import { Router } from "express";
import { asyncHandler } from "../../utils/errors.js";
import {
    getExplorerStats,
    listBlocks,
    getBlockByArg,
    listTransactions,
    getTransactionByHash,
    getAddressInfo,
    listAddressTransactions,
    searchExplorer,
} from "../../services/explorer/explorer.service.js";

const router = Router();

router.get("/stats", asyncHandler(async (_req, res) => {
    const stats = await getExplorerStats();
    return res.json(stats);
}));

router.get("/blocks", asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const out = await listBlocks(page, limit);
    return res.json(out);
}));

router.get("/blocks/:id", asyncHandler(async (req, res) => {
    const block = await getBlockByArg(req.params.id);
    if (!block) return res.status(404).json({ error: "block not found" });
    return res.json(block);
}));

router.get("/transactions", asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const out = await listTransactions(page, limit);
    return res.json(out);
}));

router.get("/transactions/:hash", asyncHandler(async (req, res) => {
    const tx = await getTransactionByHash(req.params.hash);
    if (!tx) return res.status(404).json({ error: "transaction not found" });
    return res.json(tx);
}));

router.get("/addresses/:address/transactions", asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const out = await listAddressTransactions(req.params.address, page, limit);
    return res.json(out);
}));

router.get("/addresses/:address", asyncHandler(async (req, res) => {
    const info = await getAddressInfo(req.params.address);
    if (!info) return res.status(404).json({ error: "address not found" });
    return res.json(info);
}));

router.get("/search", asyncHandler(async (req, res) => {
    const q = req.query.q;
    const result = await searchExplorer(q);
    if (!result) return res.status(404).json({ error: "not found", result: null });
    return res.json(result);
}));

export default router;
