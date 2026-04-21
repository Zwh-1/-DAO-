import { apiJson, ApiError, apiFetch } from "./api/http";
import { V1Routes } from "./api/v1Routes";

export { ApiError, apiJson, apiFetch, buildApiUrl } from "./api/http";
export { V1, V1Mount, V1Routes } from "./api/v1Routes";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const body =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;
  return apiJson<T>(path, {
    method,
    body,
    auth: options.auth,
  });
}

async function adminRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const body =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;
  return apiJson<T>(path, {
    method,
    body,
    admin: true,
    auth: false,
  });
}

export type ClaimProposePayload = {
  claimId: string;
  nullifierHash: string;
  proof: {
    protocol?: string;
    pi_a?: string[];
    pi_b?: string[][];
    pi_c?: string[];
    _isMock?: boolean;
  };
  publicSignals: string[];
  evidenceCid: string;
  address: string;
  amount: string;
};

export function proposeClaim(payload: ClaimProposePayload) {
  const body =
    process.env.NODE_ENV === "production" &&
    payload.proof &&
    "_isMock" in payload.proof
      ? {
          ...payload,
          proof: Object.fromEntries(
            Object.entries(payload.proof).filter(([k]) => k !== "_isMock"),
          ) as ClaimProposePayload["proof"],
        }
      : payload;
  return request(V1Routes.claim.propose, { method: "POST", body });
}

export function queryClaimStatus(claimId: string) {
  return request(V1Routes.claim.status(claimId), { auth: false });
}

export function commitArbitration(payload: {
  proposalId: string;
  commitment: string;
  arbitrator: string;
}) {
  return request(V1Routes.member.arbCommit, { method: "POST", body: payload });
}

export function revealArbitration(payload: {
  proposalId: string;
  choice: string;
  salt: string;
  arbitrator: string;
}) {
  return request(V1Routes.member.arbReveal, { method: "POST", body: payload });
}

/** @see backend member.routes GET /arb/tasks/my */
export function fetchMyArbTasks(_address: string) {
  return request<{ tasks: ArbTaskRow[] }>(V1Routes.member.arbTasksMy, {});
}

export type ArbTaskRow = {
  taskId: string;
  proposalId: string;
  selectedArbitrators: string[];
  status: string;
};

export function createChallenge(payload: {
  proposalId: string;
  reasonCode: string;
  evidenceSnapshot: string;
  txHash: string;
  challenger: string;
  stakeAmount: number;
}) {
  return request(V1Routes.challenge.init, { method: "POST", body: payload });
}

export type ChallengeRecord = {
  challengeId: string;
  proposalId: string;
  reasonCode: string;
  evidenceSnapshot: string;
  txHash: string;
  challenger: string;
  stakeAmount: number;
  createdAt: number;
};

export function listMyChallenges(challengerAddress: string) {
  const q = encodeURIComponent(challengerAddress);
  return request<{ challenges: ChallengeRecord[] }>(
    `${V1Routes.challenge.list}?challenger=${q}`,
  );
}

export type OracleReportSummary = {
  reportId: string;
  claimId: string;
  dataHashPreview: string;
  signatures: number;
  finalized: boolean;
  approved: boolean;
  fastTrack: boolean;
  createdAt: number;
};

export function listOracleReports(params?: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return request<{
    reports: OracleReportSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`${V1Routes.oracle.reports}${qs ? `?${qs}` : ""}`);
}

export function getOracleReportById(reportId: string) {
  return request<Record<string, unknown>>(V1Routes.oracle.reportById(reportId), {
    auth: false,
  });
}

export function submitOracleReport(body: {
  reportId: string;
  claimId: string;
  ipfsCid: string;
}) {
  return request<Record<string, unknown> & { success?: boolean; signatures?: number }>(
    V1Routes.oracle.reportPost,
    { method: "POST", body },
  );
}

export function oracleSignReport(body: { reportId: string }) {
  return request<
    Record<string, unknown> & { success?: boolean; signatures?: number; finalized?: boolean }
  >(V1Routes.oracle.sign, { method: "POST", body });
}

export type ChannelRecord = {
  channelId: string;
  channelAddress: string | null;
  participant1: string;
  participant2: string;
  totalDeposit: string;
  currentNonce: number;
  balance1: string;
  balance2: string;
  exitInitiated: boolean;
  closeRequestedAt: number | null;
  createdAt: number;
};

export function listAllChannels() {
  return request<{ channels: ChannelRecord[] }>(V1Routes.channel.all);
}

export type BlacklistEntry = {
  address: string;
  addressMasked: string;
  reason: string;
  bannedAt: number;
};

export function listBlacklistAdmin() {
  return adminRequest<{ entries: BlacklistEntry[] }>(V1Routes.guardian.blacklistGet);
}

export function getGuardianStatusAdmin() {
  return adminRequest<{ paused: boolean; bannedCount: number }>(V1Routes.guardian.status);
}

export function postGuardianCircuit(body: { action: "pause" | "resume"; reason: string }) {
  return adminRequest<{ success: boolean; message?: string }>(V1Routes.guardian.circuit, {
    method: "POST",
    body,
  });
}

export function postGuardianBlacklist(body: { address: string; reason: string }) {
  return adminRequest<{ success: boolean; address?: string }>(V1Routes.guardian.blacklistPost, {
    method: "POST",
    body,
  });
}

export function getGuardianAuditLogAdmin() {
  return adminRequest<{ logs: unknown[] }>(V1Routes.guardian.auditLog);
}

/** 守护者：分配角色（非生产；见后端 guardian.routes） */
export function postGuardianRoles(body: { address: string; roles: string[] }) {
  return adminRequest<{ ok?: boolean; error?: string; address?: string; roles?: string[] }>(
    V1Routes.guardian.roles,
    { method: "POST", body },
  );
}

export function getGuardianMemberRolesQuery(address: string) {
  return adminRequest<{ address: string; roles: string[] }>(
    V1Routes.guardian.memberRoles(address),
  );
}

export function getMemberProfile(address: string) {
  return request(V1Routes.member.profile(address));
}

export function bindWallet(payload: {
  mainAddr: string;
  newAddr: string;
  proof: string;
}) {
  return request(V1Routes.member.walletsBind, { method: "POST", body: payload });
}

// ── 链下治理（governance.routes.js，与 multisig/governance 链上队列区分）────────────────

export type GovernanceProposal = {
  id: number;
  description: string;
  proposer: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  state: string;
  endTime: number;
};

export function fetchGovernanceProposals() {
  return apiJson<{ proposals: GovernanceProposal[] }>(V1Routes.governance.proposals, {
    auth: false,
  });
}

export function submitGovernanceProposal(body: { description: string }) {
  return apiJson<Record<string, unknown> & { proposalId?: number }>(V1Routes.governance.propose, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitGovernanceVote(body: { proposalId: number; support: number }) {
  return apiJson<Record<string, unknown> & { forVotes?: string }>(V1Routes.governance.vote, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── 健康 / 浏览器 / 身份（供 React Query 等复用）────────────────────────────────────

export function fetchHealth() {
  return apiJson<Record<string, unknown>>(V1Routes.health, { auth: false });
}

export function fetchExplorerStats() {
  return apiJson<Record<string, unknown>>(V1Routes.explorer.stats, { auth: false });
}

/** GET /v1/member/profile/:address（后端无需 JWT） */
export function fetchMemberProfilePublic(address: string) {
  return apiJson<Record<string, unknown>>(V1Routes.member.profile(address), { auth: false });
}

// ── 成员活动 & 声誉 ────────────────────────────────────────────────────────

export type ActivityRow = {
  id: string;
  address: string;
  action: string;
  txHash: string | null;
  blockNumber: number | null;
  timestamp: number;
  detail: string;
};

export type ActivityResponse = {
  activities: ActivityRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** GET /v1/member/activity?address=...&page=&limit= */
export function fetchMemberActivity(address: string, page = 1, limit = 20) {
  const qs = new URLSearchParams({
    address,
    page: String(page),
    limit: String(limit),
  });
  return apiJson<ActivityResponse>(`${V1Routes.member.activity}?${qs}`, { auth: false });
}

export type ReputationResponse = {
  score: number;
  breakdown: Record<string, number>;
  trend: { date: string; score: number }[];
};

/** GET /v1/member/reputation?address=... */
export function fetchMemberReputation(address: string) {
  return apiJson<ReputationResponse>(`${V1Routes.member.reputation}?address=${encodeURIComponent(address)}`, { auth: false });
}
