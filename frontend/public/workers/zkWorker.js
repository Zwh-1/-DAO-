/* global self */
/**
 * ZK Proof Web Worker — 十条核心电路
 *
 * 消息：{ type: "GENERATE", payload: { circuitName?, input?, ...legacy flat fields } }
 * - 优先使用 payload.input（与 circom 编译产物键名一致，推荐由 lib/zk/*Witness 构造）
 * - anti_sybil_verifier 可省略 input：支持旧版扁平字段并自动补全 20 层 Merkle 路径
 *
 * 产物路径默认：/circuits/build/<name>.wasm 与 <name>_final.zkey（见 /circuits/circuits-manifest.json）
 */

const MANIFEST_URL = "/circuits/circuits-manifest.json";
const DEFAULT_MERKLE_ANTI_SYBIL = 20;

const NPUBLIC_DEFAULT = {
  identity_commitment: 2,
  anti_sybil_claim: 3,
  anonymous_claim: 7,
  anti_sybil_verifier: 8,
  confidential_transfer: 5,
  multi_sig_proposal: 3,
  privacy_payment: 4,
  reputation_verifier: 2,
  history_anchor: 2,
  private_payment: 4,
};

let manifestCache = null;

async function loadManifest() {
  if (manifestCache !== null) return manifestCache;
  try {
    const res = await fetch(MANIFEST_URL);
    manifestCache = res.ok ? await res.json() : false;
  } catch {
    manifestCache = false;
  }
  return manifestCache;
}

function resolveArtifacts(manifest, circuitName) {
  const row = manifest && manifest.circuits
    ? manifest.circuits.find((c) => c.name === circuitName)
    : null;
  const wasm = row?.wasm || `/circuits/build/${circuitName}.wasm`;
  const zkey = row?.zkey || `/circuits/build/${circuitName}_final.zkey`;
  const merkleLevels =
    row?.merkleLevels ??
    (circuitName === "anti_sybil_verifier" ? DEFAULT_MERKLE_ANTI_SYBIL : undefined);
  return { wasm, zkey, merkleLevels };
}

async function artifactsExist(wasmPath, zkeyPath) {
  try {
    const [wasmRes, zkeyRes] = await Promise.all([
      fetch(wasmPath, { method: "HEAD" }),
      fetch(zkeyPath, { method: "HEAD" }),
    ]);
    return wasmRes.ok && zkeyRes.ok;
  } catch {
    return false;
  }
}

function normalizeFieldArray(val, len, fill) {
  const src = Array.isArray(val) ? val.map((x) => String(x)) : [];
  const out = [];
  for (let i = 0; i < len; i++) out.push(i < src.length ? src[i] : fill);
  return out;
}

/**
 * 扁平 legacy → anti_sybil_verifier.circom input
 */
function buildLegacyAntiSybilVerifierInput(p, merkleLevels) {
  const pathElements = normalizeFieldArray(
    p.pathElements ?? p.path_elements,
    merkleLevels,
    "0"
  );
  const pathIndex = normalizeFieldArray(
    p.pathIndex ?? p.path_index,
    merkleLevels,
    "0"
  ).map((x) => (String(x) === "1" ? "1" : "0"));

  return {
    secret: String(p.secret ?? "0"),
    trapdoor: String(p.trapdoor ?? p.trapDoor ?? "0"),
    social_id_hash: String(p.social_id_hash ?? p.socialIdHash ?? "0"),
    pathElements,
    pathIndex,
    min_level: String(p.min_level ?? p.minLevel ?? "1"),
    min_amount: String(p.min_amount ?? p.minAmount ?? "1"),
    max_amount: String(p.max_amount ?? p.maxAmount ?? "1000000"),
    ts_start: String(p.ts_start ?? p.tsStart ?? "0"),
    ts_end: String(p.ts_end ?? p.tsEnd ?? String(Math.floor(Date.now() / 1000) + 86400)),
    airdrop_project_id: String(p.airdrop_project_id ?? p.airdropProjectId ?? "1"),
    merkle_root: String(p.merkle_root ?? p.merkleRoot ?? "0"),
    identity_commitment: String(p.identity_commitment ?? p.identityCommitment ?? "0"),
    nullifier_hash: String(p.nullifier_hash ?? p.nullifierHash ?? p.nullifier ?? "0"),
    user_level: String(p.user_level ?? p.userLevel ?? "1"),
    claim_amount: String(p.claim_amount ?? p.claimAmount ?? "1"),
    claim_ts: String(p.claim_ts ?? p.claimTs ?? String(Math.floor(Date.now() / 1000))),
    parameter_hash: String(p.parameter_hash ?? p.parameterHash ?? "0"),
    merkle_leaf: String(p.merkle_leaf ?? p.merkleLeaf ?? "0"),
  };
}

function resolveCircuitInput(circuitName, payload, merkleLevels) {
  if (payload && typeof payload.input === "object" && payload.input !== null) {
    return payload.input;
  }
  if (circuitName === "anti_sybil_verifier") {
    const levels = merkleLevels || DEFAULT_MERKLE_ANTI_SYBIL;
    return buildLegacyAntiSybilVerifierInput(payload || {}, levels);
  }
  throw new Error(
    `电路 ${circuitName} 需要 payload.input（完整 witness 对象）。请使用 lib/zk 下对应 *Witness 模块构造。`
  );
}

async function realProve(payload) {
  if (typeof snarkjs === "undefined") {
    try {
      self.importScripts("https://cdn.jsdelivr.net/npm/snarkjs@0.7.4/build/snarkjs.min.js");
    } catch {
      throw new Error("snarkjs 加载失败，请检查网络或使用本地产物");
    }
  }

  const manifest = await loadManifest();
  const circuitName =
    (payload && (payload.circuitName || payload.circuit)) || "anti_sybil_verifier";
  const { wasm, zkey, merkleLevels } = resolveArtifacts(
    manifest || {},
    circuitName
  );

  const { groth16 } = self.snarkjs;
  const input = resolveCircuitInput(circuitName, payload, merkleLevels);

  self.postMessage({ type: "PROGRESS", progress: 30 });
  self.postMessage({
    type: "STATUS",
    message:
      "本地算力加密中：您的原始身份数据绝不离端，明文不会发送至服务器…",
  });

  const { proof, publicSignals } = await groth16.fullProve(input, wasm, zkey);

  self.postMessage({ type: "PROGRESS", progress: 95 });
  return { proof, publicSignals, circuitName };
}

self.onmessage = async function (ev) {
  const msg = ev.data || {};
  if (msg.type !== "GENERATE") return;

  self.postMessage({ type: "PROGRESS", progress: 5 });

  try {
    const manifest = await loadManifest();
    const p = msg.payload || {};
    const circuitName = p.circuitName || p.circuit || "anti_sybil_verifier";
    const { wasm, zkey } = resolveArtifacts(manifest || {}, circuitName);

    // 严格预检：产物必须存在，否则直接报 Critical Error
    const hasArtifacts = await artifactsExist(wasm, zkey);
    if (!hasArtifacts) {
      throw new Error(
        "CRITICAL_ARTIFACT_MISSING: 安全电路环境加载失败——" +
          `电路 ${circuitName} 的 .wasm 或 .zkey 产物未找到（${wasm}, ${zkey}）。` +
          "请检查网络连接或联系管理员部署产物到 /circuits/build/ 目录。"
      );
    }

    self.postMessage({
      type: "STATUS",
      message: "本地算力加密中：正在生成零知识证明…",
    });
    const result = await realProve(p);

    self.postMessage({ type: "PROGRESS", progress: 100 });
    self.postMessage({
      type: "DONE",
      proof: result.proof,
      publicSignals: result.publicSignals,
      circuitName: result.circuitName,
    });
  } catch (e) {
    self.postMessage({
      type: "ERROR",
      error: e instanceof Error ? e.message : "ZK Worker 未知错误",
    });
  }
};
