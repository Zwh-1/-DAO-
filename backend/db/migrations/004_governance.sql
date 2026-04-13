-- 004_governance.sql
-- DAO 治理 / 守护者审计 / 预言机多签报告

-- ── 治理提案 ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_proposals (
  id            SERIAL PRIMARY KEY,
  description   TEXT        NOT NULL,
  proposer      VARCHAR(42) NOT NULL,
  for_votes     BIGINT      NOT NULL DEFAULT 0,
  against_votes BIGINT      NOT NULL DEFAULT 0,
  abstain_votes BIGINT      NOT NULL DEFAULT 0,
  state         SMALLINT    NOT NULL DEFAULT 1,  -- 1=Active 2=Passed 3=Defeated 4=Queued 5=Executed 6=Cancelled
  start_time    BIGINT      NOT NULL,
  end_time      BIGINT      NOT NULL,
  queued_at     BIGINT,
  executed_at   BIGINT,
  created_at    BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- ── 投票记录 ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_votes (
  proposal_id  INT         NOT NULL REFERENCES gov_proposals(id),
  voter        VARCHAR(42) NOT NULL,
  support      SMALLINT    NOT NULL,  -- 0=against 1=for 2=abstain
  weight       BIGINT      NOT NULL DEFAULT 10,
  voted_at     BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  PRIMARY KEY (proposal_id, voter)
);

-- ── 守护者审计日志 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardian_audit_log (
  id         SERIAL PRIMARY KEY,
  action     VARCHAR(20)  NOT NULL,  -- PAUSE / RESUME / BAN / UNBAN
  target     VARCHAR(42),            -- 目标地址（BAN/UNBAN 时）
  performed_by VARCHAR(255) NOT NULL,
  reason     TEXT         NOT NULL,
  created_at BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- ── 黑名单 ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardian_blacklist (
  address    VARCHAR(42)  PRIMARY KEY,
  reason     TEXT         NOT NULL,
  banned_by  VARCHAR(255) NOT NULL,
  banned_at  BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  lifted_at  BIGINT                 -- NULL 表示仍在黑名单中
);

-- ── 预言机多签报告 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oracle_reports (
  report_id   VARCHAR(100) PRIMARY KEY,
  claim_id    VARCHAR(100) NOT NULL,
  data_hash   VARCHAR(66)  NOT NULL,  -- SHA-256 of IPFS CID
  signers     TEXT[]       NOT NULL DEFAULT '{}',
  fast_track  BOOLEAN      NOT NULL DEFAULT FALSE,
  finalized   BOOLEAN      NOT NULL DEFAULT FALSE,
  approved    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_oracle_reports_claim ON oracle_reports(claim_id);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_state  ON gov_proposals(state);
