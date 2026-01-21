-- Webhook registrations for external integrations
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  secret TEXT, -- Optional HMAC secret for signature verification
  categories TEXT NOT NULL DEFAULT 'crypto,forex,stocks', -- Comma-separated
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_triggered_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0
);

-- Webhook delivery logs for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  signal_id INTEGER NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
