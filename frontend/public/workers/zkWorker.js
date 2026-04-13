/* global self */
/**
 * ZK Proof Web Worker
 *
 * Witness 输入与 `circuits/src/anti_sybil_verifier.circom` 一致（pathElements/pathIndex 深度 8）。
 * 若 /circuits/build/ 下缺少 .wasm/.zkey，则降级 Mock（演示；链上中继开启时后端会拒绝 Mock）。
 */

const WASM_PATH = "/circuits/build/anti_sybil_verifier.wasm";
const ZKEY_PATH = "/circuits/build/anti_sybil_verifier_final.zkey";
const MERKLE_LEVELS = 8;

async function artifactsExist() {
  try {
    const [wasmRes, zkeyRes] = await Promise.all([
      fetch(WASM_PATH, { method: "HEAD" }),
      fetch(ZKEY_PATH, { method: "HEAD" }),
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

async function realProve(payload) {
  if (typeof snarkjs === "undefined") {
    try {
      self.importScripts("https://cdn.jsdelivr.net/npm/snarkjs@0.7.4/build/snarkjs.min.js");
    } catch {
      throw new Error("snarkjs 加载失败，请检查网络或使用本地产物");
    }
  }

  const { groth16 } = self.snarkjs;
  const p = payload || {};

  const pathElements = normalizeFieldArray(p.pathElements ?? p.path_elements, MERKLE_LEVELS, "0");
  const pathIndex = normalizeFieldArray(p.pathIndex ?? p.path_index, MERKLE_LEVELS, "0").map((x) =>
    String(x === 1 || x === "1" ? "1" : "0")
  );

  const input = {
    secret: String(p.secret ?? "0"),
    airdrop_project_id: String(p.airdrop_project_id ?? p.airdropProjectId ?? "1"),
    pathElements,
    pathIndex,
    merkle_root: String(p.merkle_root ?? p.merkleRoot ?? "0"),
    identity_commitment: String(p.identity_commitment ?? p.identityCommitment ?? "0"),
    nullifier: String(p.nullifier ?? "0"),
    min_level: String(p.min_level ?? p.minLevel ?? "0"),
    user_level: String(p.user_level ?? p.userLevel ?? "1"),
    min_amount: String(p.min_amount ?? p.minAmount ?? "100"),
    max_amount: String(p.max_amount ?? p.maxAmount ?? "10000"),
    claim_amount: String(p.claim_amount ?? p.claimAmount ?? "1000"),
    claim_ts: String(p.claim_ts ?? p.claimTs ?? String(Math.floor(Date.now() / 1000))),
    ts_start: String(p.ts_start ?? p.tsStart ?? "0"),
    ts_end: String(p.ts_end ?? p.tsEnd ?? String(Math.floor(Date.now() / 1000) + 86400)),
  };

  self.postMessage({ type: "PROGRESS", progress: 30 });

  const { proof, publicSignals } = await groth16.fullProve(input, WASM_PATH, ZKEY_PATH);

  self.postMessage({ type: "PROGRESS", progress: 95 });
  return { proof, publicSignals };
}

async function mockProve(payload) {
  self.postMessage({ type: "PROGRESS", progress: 20 });
  await new Promise((r) => setTimeout(r, 500));
  self.postMessage({ type: "PROGRESS", progress: 60 });
  await new Promise((r) => setTimeout(r, 400));

  const ts = String(Math.floor(Date.now() / 1000));
  const hint = payload?.publicSignalsHint;
  const publicSignals =
    Array.isArray(hint) && hint.length >= 11
      ? hint.map(String)
      : ["0", "0", "0", "0", "1", "100", "10000", "1000", ts, "0", String(Number(ts) + 86400)];

  const proof = {
    protocol: "groth16",
    _isMock: true,
    pi_a: ["0x1", "0x2", "0x1"],
    pi_b: [
      ["0x3", "0x4"],
      ["0x5", "0x6"],
    ],
    pi_c: ["0x7", "0x8", "0x1"],
  };
  return { proof, publicSignals };
}

self.onmessage = async function (ev) {
  const msg = ev.data || {};
  if (msg.type !== "GENERATE") return;

  self.postMessage({ type: "PROGRESS", progress: 5 });

  try {
    let result;
    const hasArtifacts = await artifactsExist();

    if (hasArtifacts) {
      self.postMessage({ type: "STATUS", message: "本地算力加密中：正在生成零知识证明…" });
      result = await realProve(msg.payload ?? {});
    } else {
      self.postMessage({
        type: "STATUS",
        message: "演示模式：电路产物未找到，使用 Mock Proof（链上中继开启时将被后端拒绝）",
      });
      result = await mockProve(msg.payload ?? {});
    }

    self.postMessage({ type: "PROGRESS", progress: 100 });
    self.postMessage({ type: "DONE", proof: result.proof, publicSignals: result.publicSignals });
  } catch (e) {
    self.postMessage({
      type: "ERROR",
      error: e instanceof Error ? e.message : "ZK Worker 未知错误",
    });
  }
};
