-- 008_reputation.sql
-- 声誉系统与历史行为锚定

-- ── 声誉验证记录 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputation_scores (
  id                SERIAL       PRIMARY KEY,
  address           VARCHAR(42)  NOT NULL,
  reputation_hash   VARCHAR(80)  NOT NULL,       -- Poseidon(total_score)
  required_score    INT          NOT NULL,       -- 满足的下限门槛
  proof_hash        VARCHAR(66)  NOT NULL,       -- ZK 证明的摘要（审计用）
  verified_at       BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_reputation_address    ON reputation_scores(address);
CREATE INDEX IF NOT EXISTS idx_reputation_verified_at ON reputation_scores(verified_at);

-- ── 历史行为锚定（用户视角） ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS behavior_history (
  id                SERIAL       PRIMARY KEY,
  address           VARCHAR(42)  NOT NULL,
  history_hash      VARCHAR(80)  NOT NULL UNIQUE, -- Poseidon(history_data)
  behavior_level    SMALLINT     NOT NULL,        -- 0-100
  leaf_index        INT          NOT NULL,        -- Merkle 树叶子索引
  merkle_root       VARCHAR(80)  NOT NULL,        -- 锚定时的树根
  anchored_at       BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_behavior_address ON behavior_history(address);

-- ── 历史行为 Merkle 树根 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS history_anchor_roots (
  root_hash         VARCHAR(80)  PRIMARY KEY,
  created_at        BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_history_root_created ON history_anchor_roots(created_at);
