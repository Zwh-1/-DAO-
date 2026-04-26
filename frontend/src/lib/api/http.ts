/**
 * 统一 HTTP 层：浏览器用相对路径 `/v1/*`（Next rewrites），SSR 用 NEXT_PUBLIC_BACKEND_URL。
 * 路径常量见 lib/api/v1Routes.ts（V1Routes / V1Mount）；业务封装见 lib/api.ts。
 */

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

function readJwtFromStore(): string | null {
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

function readAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("adminToken") ?? "";
}

/**
 * @param path 不以域名开头，例如 `/governance/proposals` 或 `/health`（会自动加 `/v1` 前缀）
 */
export function buildApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const withV1 =
    p.startsWith("/v1/") || p === "/v1" ? p : `/v1${p}`;
  if (typeof window !== "undefined") {
    return withV1;
  }
  const base = (
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3010"
  ).replace(/\/$/, "");
  return `${base}${withV1}`;
}

export type ApiFetchOptions = RequestInit & {
  /** 默认 true：附带 JWT（trustaid-auth） */
  auth?: boolean;
  /** Admin 路由：附带 adminToken */
  admin?: boolean;
};

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { auth = true, admin = false, headers: hdrs, ...rest } = options;
  const url = buildApiUrl(path);
  const headers = new Headers(hdrs);

  if (!headers.has("Content-Type") && rest.body != null) {
    headers.set("Content-Type", "application/json");
  }

  if (admin) {
    const adm = readAdminToken();
    if (adm) headers.set("Authorization", `Bearer ${adm}`);
  } else if (auth !== false) {
    const token = readJwtFromStore();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...rest,
    headers,
    cache: "no-store",
  });
}

export async function apiJson<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.detail === "string" && data.detail) ||
      `HTTP ${res.status}`;
    throw new ApiError(
      msg,
      res.status,
      typeof data.code === "number" ? data.code : undefined,
      typeof data.detail === "string" ? data.detail : undefined,
    );
  }
  return data as T;
}
