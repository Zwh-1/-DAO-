/**
 * 后端 ZK 预校验：仅校验结构与非敏感字段，不信任见证人。
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
