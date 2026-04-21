/**
 * 生成本地随机域元素（十进制字符串），适用于 anonymous_claim 的 secret 输入。
 * 落在 BN254 标量域内（与 circom 域一致的数量级）。
 */

// circom/snark 常用标量域阶（与 circomlibjs Poseidon 域一致）
const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * 返回十进制字符串，可被 parseFieldElement 解析。
 */
export function generateRandomSecretDecimal(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let x = 0n;
  for (let i = 0; i < 32; i++) {
    x = (x << 8n) | BigInt(buf[i]);
  }
  x = x % SNARK_SCALAR_FIELD;
  if (x === 0n) {
    x = 1n;
  }
  return x.toString();
}
