#!/usr/bin/env node
/**
 * 将 circuits/build/<name>/ 下 wasm + *_final.zkey 同步到 frontend/public/circuits/build/
 * 用法：node scripts/sync-public-circuit-artifacts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, "..");
const buildRoot = path.join(circuitsRoot, "build");
const destDir = path.join(circuitsRoot, "..", "frontend", "public", "circuits", "build");

const names = [
  "identity_commitment",
  "anti_sybil_claim",
  "anonymous_claim",
  "anti_sybil_verifier",
  "confidential_transfer",
  "multi_sig_proposal",
  "privacy_payment",
  "reputation_verifier",
  "history_anchor",
  "private_payment",
];

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`[skip] missing: ${src}`);
    return false;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`[ok] ${path.basename(dst)}`);
  return true;
}

function main() {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const name of names) {
    const dir = path.join(buildRoot, name);
    const wasmSrc = path.join(dir, `${name}_js`, `${name}.wasm`);
    const wasmFlat = path.join(dir, `${name}.wasm`);
    const wasmFrom = fs.existsSync(wasmSrc) ? wasmSrc : wasmFlat;
    const zkey = path.join(dir, `${name}_final.zkey`);
    copyIfExists(wasmFrom, path.join(destDir, `${name}.wasm`));
    copyIfExists(zkey, path.join(destDir, `${name}_final.zkey`));
  }
  console.log("\nDone. See frontend/public/circuits/build/circuits-manifest.json for URL 约定。");
}

main();
