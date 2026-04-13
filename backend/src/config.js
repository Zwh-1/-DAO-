// 加载 .env.local（优先级低于已有 env vars，node --env-file 或 CI 注入的优先）
import { readFileSync } from "node:fs";
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local 不存在时静默跳过 */ }

export const config = {
  port: Number(process.env.PORT || 3010),
  nodeEnv: process.env.NODE_ENV || "development",
  rpcUrl: process.env.RPC_URL || "",
  claimVaultAddress: process.env.CLAIM_VAULT_ADDRESS || "",
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "",
  minChallengeStake: Number(process.env.MIN_CHALLENGE_STAKE || 100),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-change-me-trustaid",
  adminToken: process.env.ADMIN_TOKEN || "",
  bypassAuth: process.env.BYPASS_AUTH === "1",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
};

export function isOnchainRelayEnabled() {
  return Boolean(
    config.rpcUrl && config.claimVaultAddress && config.relayerPrivateKey
  );
}
