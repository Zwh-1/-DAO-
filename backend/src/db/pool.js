import pg from "pg";
import { config } from "../config.js";

let pool = null;

export function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
    pool.on("error", (err) => {
      console.warn("[pool] idle client error (DB may not be running):", err.message);
    });
  }
  return pool;
}

export async function insertNullifierDb(nullifierHash) {
  const p = getPool();
  if (!p) return { ok: true, skipped: true };
  const createdAt = Math.floor(Date.now() / 1000);
  try {
    await p.query(
      "INSERT INTO nullifier_registry (nullifier_hash, created_at) VALUES ($1, $2)",
      [nullifierHash, createdAt]
    );
    return { ok: true };
  } catch (e) {
    if (String(e.code) === "23505") {
      const err = new Error("duplicate nullifier");
      err.code = "DUPLICATE_NULLIFIER";
      throw err;
    }
    return { ok: true, skipped: true, reason: e.message };
  }
}

export async function countNullifiers() {
  const p = getPool();
  if (!p) return null;
  try {
    const r = await p.query("SELECT COUNT(*)::int AS c FROM nullifier_registry");
    return r.rows[0].c;
  } catch (e) {
    console.warn("[pool] countNullifiers failed:", e.message);
    return null;
  }
}

export async function insertClaimDb(row) {
  const p = getPool();
  if (!p) return { ok: true, skipped: true };
  try {
    await p.query(
      `INSERT INTO claim_records
         (claim_id, nullifier_hash, evidence_cid, claimant_address, amount, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (claim_id) DO NOTHING`,
      [
        row.claimId,
        row.nullifierHash,
        row.evidenceCid,
        row.address,
        row.amount,
        row.status || "PENDING_REVIEW",
        row.createdAt,
      ]
    );
    return { ok: true };
  } catch (e) {
    console.warn("[pool] insertClaimDb failed:", e.message);
    return { ok: true, skipped: true };
  }
}
