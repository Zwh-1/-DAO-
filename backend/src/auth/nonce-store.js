import { randomBytes } from "node:crypto";

const nonces = new Map();
const TTL_MS = 5 * 60 * 1000;

export function mintNonce() {
  const n = randomBytes(16).toString("hex");
  nonces.set(n, Date.now() + TTL_MS);
  return n;
}

export function consumeNonce(n) {
  const exp = nonces.get(n);
  if (!exp || Date.now() > exp) {
    nonces.delete(n);
    return false;
  }
  nonces.delete(n);
  return true;
}

export function extractNonceFromSiweMessage(message) {
  const lines = String(message || "").split("\n");
  const nonceLine = lines.find((l) => l.startsWith("Nonce: "));
  if (!nonceLine) return null;
  return nonceLine.replace("Nonce: ", "").trim();
}
