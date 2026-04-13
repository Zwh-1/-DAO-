#!/usr/bin/env node
/**
 * Migration helper: extension exported JSON -> wallet-sdk keystore envelope.
 *
 * Usage:
 *   node tools/migrate-extension-storage.mjs --in ./export.json --out ./.wallet-sdk.keystore.json --password your_password
 */
import fs from "node:fs/promises";
import { encryptJson } from "../src/keystore/crypto.ts";

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return "";
  return process.argv[idx + 1] || "";
}

const inputPath = arg("--in");
const outputPath = arg("--out") || ".wallet-sdk.keystore.json";
const password = arg("--password");

if (!inputPath || !password) {
  console.error("Missing --in or --password");
  process.exit(1);
}

const raw = await fs.readFile(inputPath, "utf8");
const exported = JSON.parse(raw);

const data = {
  accounts: exported.accounts || [],
  selectedAddress: exported.selectedAddress || exported.accounts?.[0]?.address || null
};
const encrypted = await encryptJson(data, password);
const envelope = { version: 1, encrypted };
await fs.writeFile(outputPath, JSON.stringify(envelope, null, 2), "utf8");
console.log(`migrated -> ${outputPath}`);
