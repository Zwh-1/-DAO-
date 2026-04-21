-- 额外索引与 commitment 唯一（阶段八）

CREATE UNIQUE INDEX IF NOT EXISTS ux_claim_records_nullifier ON claim_records (nullifier_hash);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claim_records (claimant_address);

CREATE TABLE IF NOT EXISTS identities (
  commitment TEXT PRIMARY KEY,
  level SMALLINT NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_identities_commitment ON identities (commitment);
