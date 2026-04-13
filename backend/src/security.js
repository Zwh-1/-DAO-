import { createHash } from "node:crypto";

const BANNED_HASHES = new Set(["md5", "sha1"]);
const ALLOWED_STORAGE_HASHES = new Set(["sha256", "keccak256"]);

export function assertHashAlgorithmAllowed(name) {
  const normalized = String(name || "").toLowerCase();
  if (BANNED_HASHES.has(normalized)) {
    throw new Error(`Hash algorithm is forbidden: ${normalized}`);
  }
}

export function sha256Hex(value) {
  assertHashAlgorithmAllowed("sha256");
  return createHash("sha256").update(value).digest("hex");
}

export function deriveNullifier(secret, airdropId) {
  // Nullifier must be deterministic and unlinkable to raw identity inputs.
  const payload = `${secret}:${airdropId}`;
  return `0x${sha256Hex(payload)}`;
}

export function maskAddress(address) {
  const value = String(address || "");
  if (value.length < 10) return "0x****";
  return `${value.slice(0, 6)}****${value.slice(-4)}`;
}

export function getSecurityBaseline() {
  return {
    bannedHashes: [...BANNED_HASHES],
    allowedStorageHashes: [...ALLOWED_STORAGE_HASHES],
    witnessMustStayLocal: true,
    antiReplayByNullifier: true
  };
}
