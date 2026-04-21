-- 006_anonymous_claim.sql
-- 匿名申领记录

CREATE TABLE IF NOT EXISTS anonymous_claims (
  nullifier       VARCHAR(80)  PRIMARY KEY,   -- Poseidon(secret, airdrop_id)
  amount          VARCHAR(40)  NOT NULL,       -- wei 字符串
  recipient       VARCHAR(42),                 -- 接收地址（可为空以保护隐私）
  tx_hash         VARCHAR(66),
  claimed_at      BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_anon_claim_at ON anonymous_claims(claimed_at);
