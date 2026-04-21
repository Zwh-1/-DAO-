-- 005_identity.sql
-- 身份承诺、SBT 代币与白名单 Merkle 树

-- ── 身份承诺注册表 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity_commitments (
  commitment      VARCHAR(80)  PRIMARY KEY,        -- Poseidon(social_id_hash, secret, trapdoor)
  level           SMALLINT     NOT NULL DEFAULT 1, -- 用户等级 1-5
  banned          BOOLEAN      NOT NULL DEFAULT FALSE,
  expiry_time     BIGINT       NOT NULL DEFAULT 0, -- 0 = 永不过期
  tx_hash         VARCHAR(66),                     -- 链上注册交易哈希
  registered_at   BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_identity_level   ON identity_commitments(level);
CREATE INDEX IF NOT EXISTS idx_identity_banned  ON identity_commitments(banned);

-- ── SBT 代币 ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sbt_tokens (
  token_id        VARCHAR(80)  PRIMARY KEY,
  holder_address  VARCHAR(42)  NOT NULL UNIQUE,
  commitment      VARCHAR(80)  NOT NULL REFERENCES identity_commitments(commitment),
  level           SMALLINT     NOT NULL DEFAULT 1,
  credit_score    SMALLINT     NOT NULL DEFAULT 650,  -- 0-1000
  joined_at       BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  tx_hash         VARCHAR(66)
);

CREATE INDEX IF NOT EXISTS idx_sbt_holder    ON sbt_tokens(holder_address);
CREATE INDEX IF NOT EXISTS idx_sbt_level     ON sbt_tokens(level);
CREATE INDEX IF NOT EXISTS idx_sbt_credit    ON sbt_tokens(credit_score);

-- ── 白名单 Merkle 树叶子 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whitelist_merkle_leaves (
  id              SERIAL       PRIMARY KEY,
  commitment      VARCHAR(80)  NOT NULL REFERENCES identity_commitments(commitment),
  user_level      SMALLINT     NOT NULL,
  merkle_leaf     VARCHAR(80)  NOT NULL UNIQUE,        -- Poseidon(commitment, level)
  leaf_index      INT          NOT NULL,
  merkle_root     VARCHAR(80)  NOT NULL,               -- 插入后的树根
  created_at      BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_whitelist_commitment ON whitelist_merkle_leaves(commitment);
CREATE INDEX IF NOT EXISTS idx_whitelist_root       ON whitelist_merkle_leaves(merkle_root);
