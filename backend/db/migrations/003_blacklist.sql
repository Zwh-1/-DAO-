CREATE TABLE IF NOT EXISTS blacklist (
  commitment TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  tx_hash TEXT,
  payload JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs (event_type);
