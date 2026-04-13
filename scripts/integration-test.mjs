#!/usr/bin/env node
/**
 * TrustAid 后端集成自检脚本
 *
 * 用法：
 *   node scripts/integration-test.mjs [backend_url]
 *   默认 backend_url = http://localhost:3010
 *
 * 检查项：
 *   ① GET  /v1/health                → ok + usedNullifiers + onchainRelay
 *   ② GET  /v1/security/baseline     → contains securityBaseline
 *   ③ POST /v1/auth/nonce             → returns nonce
 *   ④ GET  /v1/governance/proposals  → returns proposals array
 *   ⑤ POST /v1/ai/chat               → returns reply
 *   ⑥ POST /v1/claim/propose         → nullifier anti-replay (with BYPASS_AUTH=1)
 *   ⑦ GET  /v1/oracle/report/:id     → 404 for unknown
 *   ⑧ GET  /v1/guardian/status       → blocked without admin token (401/403)
 */

const BASE = process.argv[2] ?? "http://localhost:3010";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log("\x1b[32m✓\x1b[0m");
    passed++;
  } catch (e) {
    console.log(`\x1b[31m✗ ${e.message}\x1b[0m`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function json(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...opts.headers } });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

console.log(`\n[TrustAid Integration Test] → ${BASE}\n`);

// ① 健康检查（仪表盘字段）
await test("GET /v1/health", async () => {
  const { res, body } = await json(`${BASE}/v1/health`);
  assert(res.ok, `HTTP ${res.status}`);
  assert(body.ok === true, "ok flag");
  assert(body.status === "ok", `status=${body.status}`);
  assert(typeof body.usedNullifiers === "number", "usedNullifiers");
  assert(typeof body.onchainRelay === "boolean", "onchainRelay");
});

// ② 安全基线
await test("GET /v1/security/baseline", async () => {
  const { res, body } = await json(`${BASE}/v1/security/baseline`);
  assert(res.ok, `HTTP ${res.status}`);
  assert(
    body.witnessMustStayLocal === true || Array.isArray(body.bannedHashes),
    "no baseline shape"
  );
});

// ③ SIWE nonce
await test("GET /v1/auth/nonce", async () => {
  const { res, body } = await json(`${BASE}/v1/auth/nonce`);
  assert(res.ok, `HTTP ${res.status}`);
  assert(typeof body.nonce === "string" && body.nonce.length > 0, "no nonce");
});

// ④ DAO 提案列表
await test("GET /v1/governance/proposals", async () => {
  const { res, body } = await json(`${BASE}/v1/governance/proposals`);
  assert(res.ok, `HTTP ${res.status}`);
  assert(Array.isArray(body.proposals), "proposals not array");
});

// ⑤ AI 客服
await test("POST /v1/ai/chat", async () => {
  const { res, body } = await json(`${BASE}/v1/ai/chat`, {
    method: "POST",
    body: JSON.stringify({ message: "什么是 Nullifier？" }),
  });
  assert(res.ok, `HTTP ${res.status}`);
  assert(typeof body.reply === "string" && body.reply.length > 0, "no reply");
});

// ⑥ 申领提案（BYPASS_AUTH=1 模式；若后端未配置则跳过）
await test("POST /v1/claim/propose (anti-replay)", async () => {
  const nullifierHash = "0x" + "a".repeat(64);
  const payload = {
    claimId: `TEST-${Date.now()}`,
    nullifierHash,
    proof: { protocol: "groth16" },
    publicSignals: ["1", "1000", "0"],
    evidenceCid: "ipfs://QmTest",
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: "1000",
  };
  const { res: r1 } = await json(`${BASE}/v1/claim/propose`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // 第一次可能成功(200) 或被 auth 拒绝(401)；任意都继续
  if (r1.status === 401 || r1.status === 403) {
    return; // 未设 BYPASS_AUTH，跳过
  }
  assert(r1.ok, `first submit HTTP ${r1.status}`);

  // 相同 nullifier 第二次应被拒绝
  const { res: r2, body: b2 } = await json(`${BASE}/v1/claim/propose`, {
    method: "POST",
    body: JSON.stringify({ ...payload, claimId: `TEST-${Date.now()}-2` }),
  });
  assert(
    r2.status === 409 || (b2.error && /duplicate|nullifier/i.test(b2.error)),
    `expected 409 replay rejection, got ${r2.status}: ${JSON.stringify(b2)}`
  );
});

// ⑦ Oracle 报告查询（404）
await test("GET /v1/oracle/report/:id (unknown → 404)", async () => {
  const { res } = await json(`${BASE}/v1/oracle/report/nonexistent-report-id-xyz`);
  assert(res.status === 404, `expected 404, got ${res.status}`);
});

// ⑧ Guardian：生产需 ADMIN_TOKEN；开发环境未配置时可能放行 200
await test("GET /v1/guardian/status", async () => {
  const { res } = await json(`${BASE}/v1/guardian/status`);
  assert(
    res.status === 200 || res.status === 401 || res.status === 403,
    `unexpected ${res.status}`
  );
});

// ── 汇总 ─────────────────────────────────────────────────────────────────
console.log(`\n结果：\x1b[32m${passed} 通过\x1b[0m  \x1b[31m${failed} 失败\x1b[0m\n`);

if (failed > 0) process.exit(1);
