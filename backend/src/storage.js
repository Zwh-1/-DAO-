import { randomUUID } from "node:crypto";
import { config } from "./config.js";

const usedNullifiers   = new Set();
const claimRecords     = new Map();
const memberProfiles   = new Map();
const walletBindings   = new Map();
const arbTasks         = new Map();
const arbCommits       = new Map();
const oracleReports    = new Map();    // reportId -> report
const challengeRecords = new Map();

// ── 预言机报告（多签） ─────────────────────────────────────────────────────
const oracleReportsFull = new Map();   // reportId -> { claimId, dataHash, signers[], finalized, approved }

// ── 守护者状态 ─────────────────────────────────────────────────────────────
let systemPaused    = false;
const blacklist     = new Map();       // address -> { reason, bannedAt }
const auditLog      = [];              // { action, by, reason, ts }

// ── 治理提案 ─────────────────────────────────────────────────────────────
const govProposals  = new Map();       // id -> proposal
let   nextPropId    = 1;
const govVotes      = new Map();       // `${propId}:${voter}` -> support

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function seedArbTasks() {
  const taskId = "ARB-TASK-001";
  if (!arbTasks.has(taskId)) {
    arbTasks.set(taskId, {
      taskId,
      proposalId: "101",
      selectedArbitrators: [],
      status: "OPEN"
    });
  }
}

seedArbTasks();

export function insertNullifierOrThrow(nullifierHash) {
  if (usedNullifiers.has(nullifierHash)) {
    const err = new Error("duplicate nullifier");
    err.code = "DUPLICATE_NULLIFIER";
    throw err;
  }
  usedNullifiers.add(nullifierHash);
}

export function getUsedNullifierCount() {
  return usedNullifiers.size;
}

export function saveClaim(payload) {
  const id = payload.claimId;
  claimRecords.set(id, {
    ...payload,
    status: "PENDING_REVIEW",
    createdAt: nowTs()
  });
  return claimRecords.get(id);
}

export function getClaimById(claimId) {
  return claimRecords.get(claimId) || null;
}

export function getOrCreateMemberProfile(address) {
  const key = String(address).toLowerCase();
  if (!memberProfiles.has(key)) {
    memberProfiles.set(key, {
      address: key,
      sbtId: `SBT-${key.slice(2, 8)}`,
      creditScore: 650,
      status: "Active",
      joinedAt: nowTs(),
      roles: ["member"]
    });
  }
  return memberProfiles.get(key);
}

export function getMemberRoles(address) {
  const profile = memberProfiles.get(String(address).toLowerCase());
  return profile?.roles ?? ["member"];
}

export function setMemberRoles(address, roles) {
  const profile = getOrCreateMemberProfile(address);
  profile.roles = roles;
}

export function bindWallet(mainAddr, newAddr, proof) {
  const mainKey = String(mainAddr).toLowerCase();
  const newKey = String(newAddr).toLowerCase();
  const proofDigest = `${String(proof).slice(0, 14)}...`;
  const values = walletBindings.get(mainKey) || [];
  if (!values.includes(newKey)) {
    values.push(newKey);
    walletBindings.set(mainKey, values);
  }
  return {
    mainAddr: mainKey,
    linkedWallets: values,
    proofDigest
  };
}

export function listArbTasksByAddress(address) {
  const addressKey = String(address || "").toLowerCase();
  const all = [...arbTasks.values()];
  return all.filter((task) => {
    if (task.selectedArbitrators.length === 0) return true;
    return task.selectedArbitrators.includes(addressKey);
  });
}

export function saveArbCommit(proposalId, arbitrator, commitment) {
  const key = `${proposalId}:${String(arbitrator).toLowerCase()}`;
  arbCommits.set(key, {
    proposalId,
    arbitrator: String(arbitrator).toLowerCase(),
    commitment,
    createdAt: nowTs()
  });
  return arbCommits.get(key);
}

export function revealArbVote(proposalId, arbitrator, choice, salt) {
  const key = `${proposalId}:${String(arbitrator).toLowerCase()}`;
  if (!arbCommits.has(key)) {
    const err = new Error("commit not found");
    err.code = "ARB_COMMIT_MISSING";
    throw err;
  }
  const current = arbCommits.get(key);
  const updated = {
    ...current,
    choice,
    saltMasked: `${String(salt).slice(0, 4)}****`,
    revealedAt: nowTs()
  };
  arbCommits.set(key, updated);
  return updated;
}

export function saveOracleReport(claimId, verdict, signature, reporter) {
  const reportId = `OR-${randomUUID().slice(0, 8)}`;
  const data = {
    reportId,
    claimId,
    verdict,
    signaturePrefix: `${String(signature).slice(0, 10)}...`,
    reporter: String(reporter || "").toLowerCase(),
    createdAt: nowTs()
  };
  oracleReports.set(reportId, data);
  return data;
}

export function createChallenge(payload) {
  if (Number(payload.stakeAmount) < config.minChallengeStake) {
    const err = new Error("stake too low");
    err.code = "INSUFFICIENT_CHALLENGE_STAKE";
    throw err;
  }
  const challengeId = `CH-${randomUUID().slice(0, 8)}`;
  const data = {
    challengeId,
    ...payload,
    createdAt: nowTs()
  };
  challengeRecords.set(challengeId, data);
  return data;
}

// ── 预言机多签报告 ─────────────────────────────────────────────────────────

const MIN_QUORUM      = 3;
const FASTTRACK_QUORUM = 5;

export function submitOracleReport({ reportId, claimId, dataHash, oracle }) {
  if (oracleReportsFull.has(reportId)) {
    const err = new Error("report already exists");
    err.code = "REPORT_EXISTS";
    throw err;
  }
  const report = {
    reportId, claimId, dataHash,
    signers:   [oracle],
    fastTrack: false,
    finalized: false,
    approved:  false,
    createdAt: nowTs(),
  };
  oracleReportsFull.set(reportId, report);
  return { ...report, signatures: 1 };
}

export function signOracleReport({ reportId, oracle }) {
  const r = oracleReportsFull.get(reportId);
  if (!r) {
    const err = new Error("report not found");
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }
  if (r.finalized) {
    const err = new Error("already finalized");
    err.code = "REPORT_FINALIZED";
    throw err;
  }
  if (r.signers.includes(oracle)) {
    const err = new Error("already signed");
    err.code = "ALREADY_SIGNED";
    throw err;
  }
  r.signers.push(oracle);
  const cnt = r.signers.length;
  if (cnt >= FASTTRACK_QUORUM) r.fastTrack = true;
  if (cnt >= MIN_QUORUM) {
    r.finalized = true;
    r.approved  = true;
  }
  return { ...r, signatures: cnt };
}

export function getOracleReport(reportId) {
  const r = oracleReportsFull.get(reportId);
  if (!r) return null;
  return { ...r, signatures: r.signers.length };
}

// ── 守护者 ────────────────────────────────────────────────────────────────

export function setSystemPaused(paused, { by, reason }) {
  systemPaused = paused;
  auditLog.push({ action: paused ? "PAUSE" : "RESUME", by, reason, ts: nowTs() });
  return { paused: systemPaused };
}

export function isSystemPaused() {
  return systemPaused;
}

export function banAddress(address, { by, reason }) {
  const key = address.toLowerCase();
  blacklist.set(key, { reason, bannedAt: nowTs() });
  auditLog.push({ action: "BAN", target: key, by, reason, ts: nowTs() });
}

export function isAddressBanned(address) {
  return blacklist.has(address.toLowerCase());
}

export function getGuardianStatus() {
  return { paused: systemPaused, bannedCount: blacklist.size };
}

export function getAuditLog(limit = 50) {
  return auditLog.slice(-limit).reverse();
}

// ── DAO 治理 ────────────────────────────────────────────────────────────────

export function createProposal({ description, proposer }) {
  const id       = nextPropId++;
  const proposal = {
    id,
    description,
    proposer:     proposer.toLowerCase(),
    forVotes:     0,
    againstVotes: 0,
    abstainVotes: 0,
    state:        "1",   // Active
    startTime:    nowTs(),
    endTime:      nowTs() + 3 * 24 * 3600,
  };
  govProposals.set(id, proposal);
  return proposal;
}

export function castVote({ proposalId, voter, support }) {
  const key = `${proposalId}:${voter.toLowerCase()}`;
  if (govVotes.has(key)) {
    const err = new Error("already voted");
    err.code = "ALREADY_VOTED";
    throw err;
  }
  const proposal = govProposals.get(Number(proposalId));
  if (!proposal) {
    const err = new Error("proposal not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (nowTs() > proposal.endTime) {
    const err = new Error("voting ended");
    err.code = "VOTE_ENDED";
    throw err;
  }
  govVotes.set(key, support);
  if (support === 1)      proposal.forVotes     += 10;   // 演示：每票 +10 权重
  else if (support === 0) proposal.againstVotes += 10;
  else                    proposal.abstainVotes  += 10;

  return { ...proposal };
}

export function listProposals() {
  const now = nowTs();
  return [...govProposals.values()].map(p => {
    let state = p.state;
    if (now > p.endTime && state === "1") {
      state = p.forVotes > p.againstVotes ? "2" : "3";
      p.state = state;
    }
    return { ...p, state };
  });
}
