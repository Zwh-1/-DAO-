/**
 * 通用 ZK 验证端点（十条电路中任意一条，需对应 vkey.json）
 */

import { Router } from "express";
import { rateLimit } from "../../middleware/rate-limit.js";
import { asyncHandler } from "../../utils/errors.js";
import { verifyGroth16Full } from "../../services/identity/circuitVerify.service.js";
import { CORE_CIRCUIT_NAMES } from "../../config/circuitRegistry.js";

const router = Router();

// POST /v1/zk/verify
router.post(
  "/verify",
  rateLimit({ max: 30, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    const { circuitName, proof, pubSignals } = req.body || {};
    if (!circuitName || !proof || !pubSignals) {
      return res.status(400).json({ code: 4200, error: "circuitName, proof, pubSignals required" });
    }
    if (!CORE_CIRCUIT_NAMES.includes(String(circuitName))) {
      return res.status(400).json({
        code: 4201,
        error: `unknown circuitName; allowed: ${CORE_CIRCUIT_NAMES.join(", ")}`,
      });
    }
    const out = await verifyGroth16Full(String(circuitName), proof, pubSignals);
    if (!out.ok) {
      return res.status(400).json({ code: 4202, error: out.error, detail: out.code });
    }
    return res.json({ success: true, skipped: Boolean(out.skipped) });
  })
);

export default router;
