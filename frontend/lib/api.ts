const API_BASE = "/v1";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
};

function readPersistedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("trustaid-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  code?: number;
  status: number;
  detail?: string;

  constructor(message: string, status: number, code?: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false) {
    const token = readPersistedToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data && (data.error || data.detail)) || `HTTP ${response.status}`;
    throw new ApiError(message, response.status, data?.code, data?.detail);
  }
  return data as T;
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
  return request("/claim/propose", { method: "POST", body: payload });
}

export function queryClaimStatus(claimId: string) {
  return request(`/claim/status/${encodeURIComponent(claimId)}`, { auth: false });
}

export function commitArbitration(payload: {
  proposalId: string;
  commitment: string;
  arbitrator: string;
}) {
  return request("/arb/commit", { method: "POST", body: payload });
}

export function revealArbitration(payload: {
  proposalId: string;
  choice: string;
  salt: string;
  arbitrator: string;
}) {
  return request("/arb/reveal", { method: "POST", body: payload });
}

export function createChallenge(payload: {
  proposalId: string;
  reasonCode: string;
  evidenceSnapshot: string;
  txHash: string;
  challenger: string;
  stakeAmount: number;
}) {
  return request("/challenge/init", { method: "POST", body: payload });
}

export function getMemberProfile(address: string) {
  return request(`/member/profile/${encodeURIComponent(address)}`);
}

export function bindWallet(payload: {
  mainAddr: string;
  newAddr: string;
  proof: string;
}) {
  return request("/member/wallets/bind", { method: "POST", body: payload });
}
