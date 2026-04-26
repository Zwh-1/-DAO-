/**
 * AI 安全审计：配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 时启用 LLM 语义分析；
 * 失败或未配置时降级静态规则。不向 LLM 发送 witness/secret 等敏感字段。
 */

import { config } from "../../config.js";

const RISK_ORDER = { HIGH: 3, MED: 2, LOW: 1 };

const STATIC_SECURITY_AUDIT = {
  title: "Nullifier & verifyProof Audit",
  results: [
    {
      level: "high",
      item: "verifyProof access control",
      recommendation: "Restrict privileged verifier updates by DAO timelock.",
    },
    {
      level: "medium",
      item: "nullifier unique storage",
      recommendation: "Use database unique constraint + on-chain replay check.",
    },
    {
      level: "low",
      item: "log desensitization",
      recommendation: "Keep address masked and avoid witness fields in logs.",
    },
  ],
};

/**
 * 申领审计请求体脱敏摘要（供 LLM 与日志）
 * @param {object} body
 * @returns {object}
 */
export function sanitizeClaimBodyForAudit(body) {
  if (!body || typeof body !== "object") return {};
  const deny = new Set([
    "secret",
    "trapdoor",
    "witness",
    "privatesignals",
    "privsignals",
    "salt",
    "seed",
    "mnemonic",
    "privatekey",
    "password",
  ]);
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    const kl = k.toLowerCase();
    if (deny.has(kl)) continue;
    if (kl === "proof" && v && typeof v === "object") {
      const { pi_a, pi_b, pi_c, protocol } = v;
      out.proof_summary = {
        protocol: protocol || "",
        has_pi_a: Array.isArray(pi_a),
        has_pi_b: Array.isArray(pi_b),
        has_pi_c: Array.isArray(pi_c),
        _isMock: v._isMock === true,
      };
      continue;
    }
    if (typeof v === "string" && v.length > 800) {
      out[k] = `${v.slice(0, 800)}…(truncated)`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function runRulesAudit(body) {
  const risks = [];
  const suggestions = [];

  if (!body?.evidenceCid?.startsWith?.("ipfs://")) {
    risks.push("证据未使用 ipfs:// 指针");
    suggestions.push({
      file: "claim/propose",
      before: "evidenceCid 非 IPFS",
      after: "使用 ipfs:// 前缀的 CID",
    });
  }

  if (body?.publicSignals?.length < 2) {
    risks.push("publicSignals 长度过短，疑似异常");
  }

  const dupSuspect = String(body?.description || "")
    .toLowerCase()
    .includes("test bulk");
  if (dupSuspect) {
    risks.push("描述命中批量测试关键字");
  }

  const risk_level =
    risks.length >= 2 ? "HIGH" : risks.length === 1 ? "MED" : "LOW";
  const confidence = risk_level === "LOW" ? 0.85 : 0.62;

  return {
    risk_level,
    risk_reasons: risks,
    suggestions,
    confidence,
  };
}

function normalizeRiskLevel(s) {
  const u = String(s || "").toUpperCase();
  if (u.includes("HIGH") || u === "高") return "HIGH";
  if (u.includes("MED") || u.includes("MEDIUM") || u === "中") return "MED";
  return "LOW";
}

function mergeRisk(a, b) {
  const na = normalizeRiskLevel(a);
  const nb = normalizeRiskLevel(b);
  return RISK_ORDER[na] >= RISK_ORDER[nb] ? na : nb;
}

function parseJsonFromLlm(text) {
  const t = String(text || "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  const raw = fence ? fence[1].trim() : t;
  return JSON.parse(raw);
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @param {{ maxTokens?: number, temperature?: number }} opts
 */
async function chatCompletion(messages, opts = {}) {
  const apiKey = config.deepseekApiKey || config.openaiApiKey;
  if (!apiKey) return null;

  const isDeepSeek = Boolean(config.deepseekApiKey);
  const endpoint = isDeepSeek
    ? "https://api.deepseek.com/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const envModel = process.env.AI_AUDIT_MODEL?.trim();
  const model =
    envModel ||
    (isDeepSeek ? "deepseek-chat" : "gpt-3.5-turbo");

  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 900,
    temperature: opts.temperature ?? 0.2,
  };

  if (!isDeepSeek && String(model).includes("gpt-4")) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(18_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || String(res.status);
    throw new Error(msg);
  }
  return data;
}

/**
 * AI 审计申领提案（规则 + 可选 LLM）
 * @param {object} body 原始请求体（含 proof 等）
 */
export async function auditClaimProposal(body) {
  const rules = runRulesAudit(body);
  const sanitized = sanitizeClaimBodyForAudit(body);

  const apiKey = config.deepseekApiKey || config.openaiApiKey;
  if (!apiKey) {
    return {
      ...rules,
      audit_source: "rules",
      llm_used: false,
      privacy_note:
        "当前为规则扫描；配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 可启用 LLM 语义审计（敏感字段不会上传）。",
    };
  }

  const systemPrompt =
    "你是 TrustAid 去中心化互助平台的申领安全审计员，熟悉 ZK Groth16、Nullifier、IPFS 证据与抗女巫语义。\n" +
    "你将收到脱敏后的 JSON（不含 witness/secret）。\n" +
    "必须只输出一个 JSON 对象，不要 markdown，键为：\n" +
    '{"risk_level":"HIGH"|"MED"|"LOW","risk_reasons":string[],"suggestions":array of {"file":string,"before":string,"after":string},"confidence":number between 0 and 1,"notes":string}\n' +
    "关注：证据 CID 规范、描述是否可疑、publicSignals 与金额一致性提示、过度夸张的理赔表述；不要索要或假设私钥。";

  try {
    const data = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(sanitized),
        },
      ],
      { maxTokens: 900, temperature: 0.2 }
    );

    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseJsonFromLlm(content);

    const llmLevel = normalizeRiskLevel(parsed.risk_level);
    const mergedLevel = mergeRisk(rules.risk_level, llmLevel);

    const rr = [...(rules.risk_reasons || [])];
    if (Array.isArray(parsed.risk_reasons)) {
      for (const r of parsed.risk_reasons) {
        if (r && !rr.includes(r)) rr.push(r);
      }
    }

    const sg = [...(rules.suggestions || [])];
    if (Array.isArray(parsed.suggestions)) {
      for (const s of parsed.suggestions) {
        if (s && typeof s === "object") sg.push(s);
      }
    }

    let confidence = rules.confidence;
    if (typeof parsed.confidence === "number" && !Number.isNaN(parsed.confidence)) {
      confidence = Math.min(0.95, Math.max(confidence, parsed.confidence));
    }

    return {
      risk_level: mergedLevel,
      risk_reasons: rr,
      suggestions: sg,
      confidence,
      audit_source: "hybrid",
      llm_used: true,
      llm_notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return {
      ...rules,
      audit_source: "rules",
      llm_used: false,
      llm_error: "LLM 调用失败，已降级为规则扫描",
    };
  }
}

/**
 * 管理者：架构级安全审计（LLM + 静态兜底）
 */
export async function auditSecurityArchitecture() {
  const apiKey = config.deepseekApiKey || config.openaiApiKey;
  if (!apiKey) {
    return { ...STATIC_SECURITY_AUDIT, source: "static" };
  }

  const systemPrompt =
    "你是智能合约与 Web3 API 安全审计助手。针对 TrustAid（SIWE JWT、ClaimVaultZK、AnonymousClaim、PlatformRoleRegistry、Nullifier、Groth16Verifier）。\n" +
    "只输出一个 JSON 对象，不要 markdown，结构为：\n" +
    '{"title":string,"results":array of {"level":"high"|"medium"|"low","item":string,"recommendation":string}}\n' +
    "至少 5 条；必须覆盖：Nullifier 唯一存储、verifyProof 权限、生产禁用 Mock Verifier、日志脱敏、JWT 角色与链上可对账。";

  try {
    const data = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "请生成简短审计条目列表（中文 recommendation 亦可），偏重可执行修复建议。",
        },
      ],
      { maxTokens: 1200, temperature: 0.25 }
    );

    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseJsonFromLlm(content);

    if (!parsed.results || !Array.isArray(parsed.results)) {
      throw new Error("invalid LLM shape");
    }

    return {
      title: parsed.title || STATIC_SECURITY_AUDIT.title,
      results: parsed.results,
      source: "llm",
    };
  } catch {
    return { ...STATIC_SECURITY_AUDIT, source: "static_fallback" };
  }
}

export { STATIC_SECURITY_AUDIT };
