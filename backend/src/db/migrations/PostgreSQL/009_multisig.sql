-- 009_multisig.sql
-- 多签提案验证与 Governance

-- ── 多签 ZK 验证记录 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS multisig_verifications (
  id                SERIAL       PRIMARY KEY,
  proposal_id       VARCHAR(40)  NOT NULL,
  auth_hash         VARCHAR(80)  NOT NULL,       -- Poseidon(total_weighted_votes, proposal_id, 1)
  threshold         VARCHAR(40)  NOT NULL,
  verified_at       BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_multisig_proposal_id ON multisig_verifications(proposal_id);
