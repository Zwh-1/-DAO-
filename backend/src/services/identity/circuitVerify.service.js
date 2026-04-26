/**
 * 链下 Groth16 全量验证（snarkjs + vkey.json）
 * vkey 缺失时：ZK_VERIFY_SKIP_MISSING=1 则跳过验证（仅开发）；否则返回失败。
 */

import fs from "fs";
import { groth16 } from "snarkjs";
import { CIRCUIT_META, vkeyPathFor } from "../../config/circuitRegistry.js";
import { config } from "../../config.js";

const _vkeyCache = new Map();

function loadVkey(circuitName) {
  if (_vkeyCache.has(circuitName)) return _vkeyCache.get(circuitName);
  const p = vkeyPathFor(circuitName);
  if (!fs.existsSync(p)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  _vkeyCache.set(circuitName, raw);
  return raw;
}

/** snarkjs fullProve / export 的证明格式 → groth16.verify 所需结构 */
export function normalizeProofForSnarkjs(proof) {
  if (!proof || typeof proof !== "object") return null;
  const pi_a = proof.pi_a ?? proof.pA;
  const pi_b = proof.pi_b ?? proof.pB;
  const pi_c = proof.pi_c ?? proof.pC;
  if (!Array.isArray(pi_a) || !Array.isArray(pi_b) || !Array.isArray(pi_c)) return null;
  return {
    pi_a: pi_a.map((x) => String(x)),
    pi_b: pi_b.map((row) => (Array.isArray(row) ? row.map((x) => String(x)) : row)),
    pi_c: pi_c.map((x) => String(x)),
    protocol: proof.protocol || "groth16",
    curve: proof.curve || "bn128",
  };
}

/**
 * @param {string} circuitName
 * @param {object} proof
 * @param {string[]|bigint[]} publicSignals
 * @returns {Promise<{ ok: boolean, code?: string, error?: string, skipped?: boolean }>}
 */
export async function verifyGroth16Full(circuitName, proof, publicSignals) {
  const meta = CIRCUIT_META[circuitName];
  if (!meta) {
    return { ok: false, code: "UNKNOWN_CIRCUIT", error: `Unknown circuit: ${circuitName}` };
  }
  if (!Array.isArray(publicSignals) || publicSignals.length !== meta.nPublic) {
    return {
      ok: false,
      code: "BAD_PUBLIC_LENGTH",
      error: `publicSignals must have ${meta.nPublic} elements for ${circuitName}`,
    };
  }

  const vkey = loadVkey(circuitName);
  if (!vkey) {
    if (config.zkVerifySkipMissingVkey) {
      return { ok: true, skipped: true };
    }
    return {
      ok: false,
      code: "VKEY_MISSING",
      error: `vkey.json not found for ${circuitName} (set ZK_CIRCUITS_BUILD_DIR or run circuits setup; or set ZK_VERIFY_SKIP_MISSING_VKEY=1 for dev)`,
    };
  }

  const p = normalizeProofForSnarkjs(proof);
  if (!p) {
    return { ok: false, code: "BAD_PROOF_SHAPE", error: "Invalid Groth16 proof object" };
  }

  const pub = publicSignals.map((x) => String(x));
  try {
    const ok = await groth16.verify(vkey, pub, p);
    if (!ok) return { ok: false, code: "VERIFY_FAILED", error: "groth16.verify returned false" };
    return { ok: true };
  } catch (e) {
    return { ok: false, code: "VERIFY_ERROR", error: String(e?.message || e) };
  }
}
