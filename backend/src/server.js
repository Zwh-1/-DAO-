import cors from "cors";
import express from "express";
import { verifyMessage } from "ethers";
import {
  deriveNullifier,
  getSecurityBaseline,
  maskAddress
} from "./security.js";
import { config, isOnchainRelayEnabled } from "./config.js";
import { parseGroth16ProofForVault, submitClaimOnchain } from "./onchain.js";
import { signJwt } from "./auth/jwt.js";
import {
  consumeNonce,
  extractNonceFromSiweMessage,
  mintNonce
} from "./auth/nonce-store.js";
import { requireAdmin, requireAuth, requireRole } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { countNullifiers, getPool, insertClaimDb, insertNullifierDb } from "./db/pool.js";
import { auditClaimProposal } from "./services/aiAudit.service.js";
import { recommendStakingRatio } from "./services/riskEngine.service.js";
import { preVerifyProofPayload } from "./services/zkVerify.service.js";
import {
  bindWallet,
  createChallenge,
  getClaimById,
  getOrCreateMemberProfile,
  getUsedNullifierCount,
  insertNullifierOrThrow,
  listArbTasksByAddress,
  revealArbVote,
  saveArbCommit,
  saveOracleReport,
  saveClaim,
  // Oracle
  submitOracleReport,
  signOracleReport,
  getOracleReport,
  // Guardian
  setSystemPaused,
  isSystemPaused,
  banAddress,
  getGuardianStatus,
  getAuditLog,
  // Governance
  createProposal,
  castVote,
  listProposals,
  // Roles
  getMemberRoles,
  setMemberRoles,
} from "./storage.js";
import { chatWithAI } from "./services/aiChat.service.js";

const app = express();
const port = config.port;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

async function insertNullifierUnified(nullifierHash) {
  const p = getPool();
  if (p) {
    await insertNullifierDb(nullifierHash);
    return;
  }
  insertNullifierOrThrow(nullifierHash);
}

function validateClaimPayload(body) {
  const required = ["claimId", "nullifierHash", "proof", "publicSignals", "evidenceCid", "amount"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      return `Missing required field: ${key}`;
    }
  }
  if (!Array.isArray(body.publicSignals)) {
    return "publicSignals must be an array";
  }
  return null;
}

app.get("/v1/health", async (_, res) => {
  const p = getPool();
  const usedNullifiers = p ? await countNullifiers() : getUsedNullifierCount();
  res.json({
    ok: true,
    service: "trustaid-backend",
    status: "ok",
    usedNullifiers,
    onchainRelay: isOnchainRelayEnabled(),
    timestamp: Date.now()
  });
});

app.get("/v1/auth/nonce", (_, res) => {
  return res.json({ nonce: mintNonce() });
});

app.post("/v1/auth/verify", (req, res) => {
  const { message, signature } = req.body || {};
  if (!message || !signature) {
    return res.status(400).json({ code: 4001, error: "message/signature 必填" });
  }
  const nonce = extractNonceFromSiweMessage(message);
  if (!nonce || !consumeNonce(nonce)) {
    return res.status(400).json({ code: 1001, error: "nonce 无效或过期" });
  }
  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return res.status(400).json({ code: 1001, error: "Invalid_Signature" });
  }
  const address = recovered.toLowerCase();
  const exp = Date.now() + 24 * 3600 * 1000;
  getOrCreateMemberProfile(address);
  const roles = getMemberRoles(address);
  const token = signJwt({ address, roles, exp }, config.jwtSecret);
  return res.json({ token, address, roles, expiresAt: exp });
});

app.get("/v1/security/baseline", (_, res) => {
  res.json(getSecurityBaseline());
});

app.get("/v1/risk/recommend", (_, res) => {
  return res.json(recommendStakingRatio({ recentNullifierCollisions: 0 }));
});

app.post("/v1/claim/audit", requireAuth, async (req, res) => {
  const report = await auditClaimProposal(req.body || {});
  return res.json(report);
});

app.post("/v1/claim/propose", requireAuth, async (req, res) => {
  const error = validateClaimPayload(req.body);
  if (error) {
    return res.status(400).json({ code: 4001, error });
  }

  const zk = preVerifyProofPayload(req.body);
  if (!zk.ok) {
    return res.status(400).json({ code: zk.code, error: zk.error });
  }

  if (isOnchainRelayEnabled()) {
    if (req.body.proof && req.body.proof._isMock === true) {
      return res.status(400).json({
        code: 2009,
        error: "链上中继已启用：请使用真实 snarkjs 证明（非 Mock）"
      });
    }
    try {
      parseGroth16ProofForVault(req.body.proof);
    } catch (e) {
      return res.status(400).json({
        code: 2001,
        error: e.code === "INVALID_PROOF_SHAPE" ? String(e.message) : "Invalid Groth16 proof for relay"
      });
    }
    const sigs = req.body.publicSignals;
    if (!Array.isArray(sigs) || sigs.length < 11) {
      return res.status(400).json({
        code: 4006,
        error: "publicSignals must have 11 elements (anti_sybil_verifier) when on-chain relay is enabled"
      });
    }
    const amountFromProof = String(BigInt(String(sigs[7])));
    if (amountFromProof !== String(req.body.amount ?? "").trim()) {
      return res.status(400).json({ code: 4007, error: "amount must match publicSignals[7] (claim_amount)" });
    }
    const nh = String(req.body.nullifierHash ?? "").toLowerCase();
    const fromProof =
      "0x" +
      BigInt(String(sigs[2]))
        .toString(16)
        .padStart(64, "0");
    if (fromProof.toLowerCase() !== nh) {
      return res.status(400).json({ code: 4008, error: "nullifierHash must match publicSignals[2]" });
    }
  }

  const { claimId, nullifierHash, evidenceCid, address, amount } = req.body;
  const authed = String(req.auth?.address || "").toLowerCase();
  if (authed && String(address || "").toLowerCase() !== authed) {
    return res.status(403).json({ code: 9003, error: "地址与登录钱包不一致" });
  }

  try {
    await insertNullifierUnified(nullifierHash);
  } catch (err) {
    if (err.code === "DUPLICATE_NULLIFIER") {
      return res.status(409).json({
        code: 2002,
        error: "Nullifier already used (anti-replay triggered)"
      });
    }
    return res.status(500).json({ code: 5002, error: "Nullifier registry unavailable" });
  }

  const claim = saveClaim({
    claimId,
    nullifierHash,
    proof: req.body.proof,
    publicSignals: req.body.publicSignals,
    evidenceCid,
    address: String(address || "").toLowerCase(),
    amount: String(amount)
  });
  try {
    await insertClaimDb({
      claimId,
      nullifierHash,
      evidenceCid,
      address: claim.address,
      amount: claim.amount,
      status: claim.status,
      createdAt: claim.createdAt
    });
  } catch {
    // 数据库未迁移或无连接时忽略（仍以内存为准）
  }

  let onchain = { mode: "disabled" };
  try {
    onchain = await submitClaimOnchain({
      proof: req.body.proof,
      publicSignals: req.body.publicSignals
    });
  } catch (err) {
    return res.status(409).json({
      code: 2003,
      error: "On-chain relay failed",
      detail: String(err.message || err)
    });
  }

  // Never log witness/secret/trapdoor/raw identity data.
  console.log(
    `[claim] accepted claimId=${claimId} nullifier=${nullifierHash.slice(
      0,
      12
    )}... address=${maskAddress(address)} cid=${evidenceCid}`
  );

  return res.status(202).json({
    code: 0,
    status: claim.status,
    claimId,
    nullifierHash,
    onchain
  });
});

app.post("/v1/nullifier/derive", requireAuth, (req, res) => {
  const { secret, airdropId } = req.body || {};
  if (!secret || !airdropId) {
    return res.status(400).json({ code: 4002, error: "secret and airdropId are required" });
  }
  return res.json({ nullifierHash: deriveNullifier(secret, airdropId) });
});

app.get("/v1/audit/nullifier", async (_, res) => {
  const p = getPool();
  const used = p ? await countNullifiers() : getUsedNullifierCount();
  res.json({
    riskLevel: "low",
    usedNullifierCount: used,
    suggestion: "Persist used nullifiers and protect insert with unique index."
  });
});

app.get("/v1/claim/status/:id", (req, res) => {
  const claim = getClaimById(req.params.id);
  if (!claim) {
    return res.status(404).json({ code: 4041, error: "Claim not found" });
  }
  return res.json(claim);
});

app.get("/v1/member/profile/:address", (req, res) => {
  const profile = getOrCreateMemberProfile(req.params.address);
  return res.json(profile);
});

app.post("/v1/member/wallets/bind", requireAuth, (req, res) => {
  const { mainAddr, newAddr, proof } = req.body || {};
  if (!mainAddr || !newAddr || !proof) {
    return res.status(400).json({ code: 4003, error: "mainAddr/newAddr/proof are required" });
  }
  const result = bindWallet(mainAddr, newAddr, proof);
  return res.status(201).json(result);
});

app.get("/v1/arb/tasks/my", (req, res) => {
  const address = String(req.query.address || "");
  if (!address) {
    return res.status(400).json({ code: 3002, error: "address query is required" });
  }
  return res.json({ tasks: listArbTasksByAddress(address) });
});

app.post("/v1/arb/commit", requireAuth, requireRole("arbitrator"), (req, res) => {
  const { proposalId, commitment, arbitrator } = req.body || {};
  if (!proposalId || !commitment || !arbitrator) {
    return res
      .status(400)
      .json({ code: 3003, error: "proposalId/commitment/arbitrator are required" });
  }
  const row = saveArbCommit(proposalId, arbitrator, commitment);
  return res.status(201).json(row);
});

app.post("/v1/arb/reveal", requireAuth, requireRole("arbitrator"), (req, res) => {
  const { proposalId, choice, salt, arbitrator } = req.body || {};
  if (!proposalId || choice === undefined || !salt || !arbitrator) {
    return res.status(400).json({ code: 3004, error: "proposalId/choice/salt/arbitrator required" });
  }
  try {
    const row = revealArbVote(proposalId, arbitrator, choice, salt);
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === "ARB_COMMIT_MISSING") {
      return res.status(404).json({ code: 3001, error: "Not_Selected_Arbitrator or commit missing" });
    }
    return res.status(500).json({ code: 5003, error: "Arbitration reveal failed" });
  }
});

// Legacy Oracle report endpoint (deprecated): keep for old clients only.
app.post("/v1/oracle/legacy-report", requireAuth, (req, res) => {
  const { claimId, verdict, signature, reporter } = req.body || {};
  if (!claimId || !verdict || !signature) {
    return res.status(400).json({ code: 4004, error: "claimId/verdict/signature are required" });
  }
  const report = saveOracleReport(claimId, verdict, signature, reporter);
  return res.status(201).json({
    ...report,
    deprecated: true,
    message: "This endpoint is deprecated. Please migrate to POST /v1/oracle/report with reportId/claimId/ipfsCid."
  });
});

app.post(
  "/v1/challenge/init",
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 20,
    keyFn: (req) => `ch:${req.auth?.address || req.ip}`
  }),
  (req, res) => {
  const { proposalId, reasonCode, evidenceSnapshot, txHash, challenger, stakeAmount } = req.body || {};
  if (!proposalId || !reasonCode || !txHash || !challenger || stakeAmount === undefined) {
    return res.status(400).json({
      code: 4005,
      error: "proposalId/reasonCode/txHash/challenger/stakeAmount are required"
    });
  }
  try {
    const challenge = createChallenge({
      proposalId,
      reasonCode,
      evidenceSnapshot: evidenceSnapshot || "",
      txHash,
      challenger: String(challenger).toLowerCase(),
      stakeAmount: Number(stakeAmount)
    });
    return res.status(201).json(challenge);
  } catch (err) {
    if (err.code === "INSUFFICIENT_CHALLENGE_STAKE") {
      return res.status(400).json({ code: 4001, error: "Insufficient_SBT_Credit or stake too low" });
    }
    return res.status(500).json({ code: 5004, error: "Challenge create failed" });
  }
});

app.get("/v1/ai/security-audit", requireAdmin, (_, res) => {
  res.json({
    title: "Nullifier & verifyProof Audit",
    results: [
      {
        level: "high",
        item: "verifyProof access control",
        recommendation: "Restrict privileged verifier updates by DAO timelock."
      },
      {
        level: "medium",
        item: "nullifier unique storage",
        recommendation: "Use database unique constraint + on-chain replay check."
      },
      {
        level: "low",
        item: "log desensitization",
        recommendation: "Keep address masked and avoid witness fields in logs."
      }
    ]
  });
});

// ── Oracle 多签报告 ────────────────────────────────────────────────────────

app.post("/v1/oracle/report", requireAuth, requireRole("oracle"), rateLimit({ max: 10, windowMs: 60_000 }), async (req, res) => {
  const { reportId, claimId, ipfsCid } = req.body;
  if (!reportId || !claimId || !ipfsCid) {
    return res.status(400).json({ error: "reportId / claimId / ipfsCid 均为必填" });
  }
  if (!ipfsCid.startsWith("ipfs://")) {
    return res.status(400).json({ error: "ipfsCid 必须以 ipfs:// 开头" });
  }
  const { createHash } = await import("node:crypto");
  const dataHash = createHash("sha256").update(ipfsCid).digest("hex");
  try {
    const report = submitOracleReport({
      reportId,
      claimId,
      dataHash,
      oracle: req.user?.address ?? "relayer",
    });
    return res.json({ success: true, ...report });
  } catch (err) {
    if (err.code === "REPORT_EXISTS") return res.status(409).json({ error: "报告已存在" });
    return res.status(500).json({ error: err.message });
  }
});

app.post("/v1/oracle/sign", requireAuth, requireRole("oracle"), rateLimit({ max: 20, windowMs: 60_000 }), (req, res) => {
  const { reportId } = req.body;
  if (!reportId) return res.status(400).json({ error: "reportId 为必填" });
  try {
    const result = signOracleReport({
      reportId,
      oracle: req.user?.address ?? "anon",
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    const MAP = {
      REPORT_NOT_FOUND: [404, "报告不存在"],
      REPORT_FINALIZED: [409, "报告已终结"],
      ALREADY_SIGNED:   [409, "您已签名过该报告"],
    };
    const [status, msg] = MAP[err.code] ?? [500, err.message];
    return res.status(status).json({ error: msg });
  }
});

app.get("/v1/oracle/report/:reportId", (req, res) => {
  const report = getOracleReport(req.params.reportId);
  if (!report) return res.status(404).json({ error: "报告不存在" });
  return res.json(report);
});

// ── Guardian 熔断 & 黑名单 ────────────────────────────────────────────────

app.get("/v1/guardian/status", requireAdmin, (req, res) => {
  res.json(getGuardianStatus());
});

app.post("/v1/guardian/circuit", requireAdmin, rateLimit({ max: 5, windowMs: 60_000 }), (req, res) => {
  const { action, reason } = req.body;
  if (!["pause", "resume"].includes(action)) {
    return res.status(400).json({ error: "action 须为 pause 或 resume" });
  }
  if (!reason?.trim()) {
    return res.status(400).json({ error: "reason 不能为空（写入审计日志）" });
  }
  const result = setSystemPaused(action === "pause", {
    by: req.adminToken ?? "admin",
    reason: reason.trim(),
  });
  res.json({ success: true, message: `系统已${action === "pause" ? "暂停" : "恢复"}`, ...result });
});

app.post("/v1/guardian/blacklist", requireAdmin, rateLimit({ max: 20, windowMs: 60_000 }), (req, res) => {
  const { address, reason } = req.body;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: "address 格式错误" });
  }
  if (!reason?.trim()) {
    return res.status(400).json({ error: "reason 不能为空" });
  }
  banAddress(address, { by: req.adminToken ?? "admin", reason: reason.trim() });
  res.json({ success: true, address: maskAddress(address) });
});

app.get("/v1/guardian/audit-log", requireAdmin, (req, res) => {
  res.json({ logs: getAuditLog(100) });
});

app.post("/v1/guardian/roles", requireAdmin, (req, res) => {
  const { address, roles } = req.body || {};
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: "address 格式错误" });
  }
  const validRoles = ["member", "arbitrator", "challenger", "oracle", "guardian", "dao"];
  if (!Array.isArray(roles) || roles.some((r) => !validRoles.includes(r))) {
    return res.status(400).json({ error: `roles 必须是以下角色的子集：${validRoles.join(", ")}` });
  }
  setMemberRoles(address, roles);
  res.json({ ok: true, address: address.toLowerCase(), roles });
});

app.get("/v1/guardian/member-roles/:address", requireAdmin, (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: "address 格式错误" });
  }
  const roles = getMemberRoles(address);
  res.json({ address: address.toLowerCase(), roles });
});

// ── Governance 提案 & 投票 ────────────────────────────────────────────────

app.get("/v1/governance/proposals", (req, res) => {
  res.json({ proposals: listProposals() });
});

app.post("/v1/governance/propose", requireAuth, rateLimit({ max: 5, windowMs: 3_600_000 }), (req, res) => {
  const { description } = req.body;
  if (!description?.trim()) {
    return res.status(400).json({ error: "description 不能为空" });
  }
  if (isSystemPaused()) {
    return res.status(503).json({ error: "系统已暂停，无法发起提案" });
  }
  const proposal = createProposal({
    description: description.trim(),
    proposer: req.user?.address ?? "0x0000",
  });
  res.status(201).json({ success: true, proposalId: proposal.id, proposal });
});

app.post("/v1/governance/vote", requireAuth, rateLimit({ max: 30, windowMs: 3_600_000 }), (req, res) => {
  const { proposalId, support } = req.body;
  if (proposalId === undefined || support === undefined) {
    return res.status(400).json({ error: "proposalId 和 support 均为必填" });
  }
  if (![0, 1, 2].includes(Number(support))) {
    return res.status(400).json({ error: "support 须为 0（反对）、1（赞成）、2（弃权）" });
  }
  try {
    const updated = castVote({
      proposalId: Number(proposalId),
      voter: req.user?.address ?? "0x0000",
      support: Number(support),
    });
    res.json({ success: true, ...updated });
  } catch (err) {
    const MAP = {
      ALREADY_VOTED: [409, "您已对该提案投过票"],
      NOT_FOUND:     [404, "提案不存在"],
      VOTE_ENDED:    [410, "投票期已结束"],
    };
    const [status, msg] = MAP[err.code] ?? [500, err.message];
    res.status(status).json({ error: msg });
  }
});

// ── AI 智能客服 ────────────────────────────────────────────────────────────

app.post("/v1/ai/chat", rateLimit({ max: 20, windowMs: 60_000 }), async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "message 不能为空" });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: "message 不超过 500 字" });
  }
  try {
    const reply = await chatWithAI(message.trim());
    res.json({ reply });
  } catch {
    res.status(500).json({ reply: "AI 服务暂时不可用，请稍后再试。" });
  }
});

app.listen(port, () => {
  console.log(`[trustaid-backend] listening on http://localhost:${port}`);
});
