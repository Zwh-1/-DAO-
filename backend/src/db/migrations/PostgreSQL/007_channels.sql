-- 007_channels.sql
-- 支付通道与保密转账

-- ── 支付通道表 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_channels (
  channel_id        VARCHAR(80)  PRIMARY KEY,
  channel_address   VARCHAR(42),                   -- 链上部署后的合约地址
  participant1      VARCHAR(42)  NOT NULL,
  participant2      VARCHAR(42)  NOT NULL,
  total_deposit     VARCHAR(40)  NOT NULL,         -- wei
  current_nonce     BIGINT       NOT NULL DEFAULT 0,
  balance1          VARCHAR(40)  NOT NULL,
  balance2          VARCHAR(40)  NOT NULL,
  exit_initiated    BOOLEAN      NOT NULL DEFAULT FALSE,
  close_requested_at BIGINT,                       -- 挑战期开始时间
  created_at        BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_channel_p1 ON payment_channels(participant1);
CREATE INDEX IF NOT EXISTS idx_channel_p2 ON payment_channels(participant2);

-- ── 通道状态历史 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_states (
  id                SERIAL       PRIMARY KEY,
  channel_id        VARCHAR(80)  NOT NULL REFERENCES payment_channels(channel_id),
  nonce             BIGINT       NOT NULL,
  balance1          VARCHAR(40)  NOT NULL,
  balance2          VARCHAR(40)  NOT NULL,
  updated_at        BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_channel_states_id ON channel_states(channel_id, nonce);

-- ── 保密转账 Nullifiers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS confidential_transfers (
  nullifier         VARCHAR(80)  PRIMARY KEY,    -- Poseidon(amount, salt, transaction_id)
  transaction_id    VARCHAR(80)  NOT NULL,
  amount_commitment VARCHAR(80)  NOT NULL,       -- Poseidon(amount, salt)
  tx_hash           VARCHAR(66),                 -- 可选链上中继 tx hash
  created_at        BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_transfer_tx_id ON confidential_transfers(transaction_id);
