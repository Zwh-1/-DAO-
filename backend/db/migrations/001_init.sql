-- PostgreSQL schema for anti-replay and role workflows

CREATE TABLE IF NOT EXISTS claim_records (
  claim_id TEXT PRIMARY KEY,
  nullifier_hash TEXT NOT NULL UNIQUE,
  evidence_cid TEXT NOT NULL,
  claimant_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS nullifier_registry (
  id BIGSERIAL PRIMARY KEY,
  nullifier_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_nullifier_hash
  ON nullifier_registry(nullifier_hash);

CREATE TABLE IF NOT EXISTS wallet_bindings (
  id BIGSERIAL PRIMARY KEY,
  main_address TEXT NOT NULL,
  linked_address TEXT NOT NULL,
  proof_digest TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE(main_address, linked_address)
);
