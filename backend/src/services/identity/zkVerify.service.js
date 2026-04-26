/**
 * 后端 ZK 预校验：仅校验结构与非敏感字段，不信任见证人。
 *
 * 生产语义：链上 Groth16Verifier 为最终真理源；全量链下校验见 `circuitVerify.service.js`（snarkjs + `circuits/build/<电路>/vkey.json`）。
 *
 * @param {object} body claim/propose 请求体
 * @returns {{ ok: boolean, code?: number, error?: string }}
 */
export function preVerifyProofPayload(body) {
  if (!body.proof || typeof body.proof !== "object") {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：缺少 proof" };
  }
  if (!Array.isArray(body.publicSignals) || body.publicSignals.length < 1) {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：publicSignals 非法" };
  }
  const proto = String(body.proof.protocol || "");
  if (proto && proto !== "groth16") {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：仅支持 groth16（MVP）" };
  }
  return { ok: true };
}

/**
 * anonymous_claim 专用：校验 Groth16 结构与 7 个公开信号（与 anonymous_claim.circom / AnonymousClaim.sol 一致）
 */
export function preVerifyAnonymousClaimPayload(body) {
  if (!body.proof || typeof body.proof !== "object") {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：缺少 proof" };
  }
  const proof = body.proof;
  const pi_a = proof.pi_a ?? proof.pA;
  const pi_b = proof.pi_b ?? proof.pB;
  const pi_c = proof.pi_c ?? proof.pC;
  if (!Array.isArray(pi_a) || pi_a.length < 2) {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：pi_a 非法" };
  }
  if (!Array.isArray(pi_b) || !Array.isArray(pi_b[0])) {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：pi_b 非法" };
  }
  if (!Array.isArray(pi_c) || pi_c.length < 2) {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：pi_c 非法" };
  }
  const pubSignals = body.pubSignals;
  if (!Array.isArray(pubSignals) || pubSignals.length !== 7) {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：anonymous claim 需要 7 个 pubSignals" };
  }
  const proto = String(proof.protocol || "");
  if (proto && proto !== "groth16") {
    return { ok: false, code: 2001, error: "ZK_Proof_Failed：仅支持 groth16（MVP）" };
  }
  return { ok: true };
}
