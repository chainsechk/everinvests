-- migrations/0001_init.sql
-- Shared macro context (generated per scheduled time)
CREATE TABLE macro_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  time_slot     TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  dxy_bias      TEXT,
  vix_level     TEXT,
  yields_bias   TEXT,
  overall       TEXT,
  data_json     TEXT,
  UNIQUE(date, time_slot)
);

-- Category-level signals
CREATE TABLE signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL,
  date          TEXT NOT NULL,
  time_slot     TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  bias          TEXT NOT NULL,
  macro_id      INTEGER REFERENCES macro_signals(id),
  data_json     TEXT,
  output_json   TEXT,
  UNIQUE(category, date, time_slot)
);

-- Per-asset breakdown
CREATE TABLE asset_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id     INTEGER NOT NULL REFERENCES signals(id),
  ticker        TEXT NOT NULL,
  bias          TEXT,
  price         REAL,
  vs_20d_ma     TEXT,
  secondary_ind TEXT,
  data_json     TEXT
);

-- Run logs for observability
CREATE TABLE run_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT,
  time_slot     TEXT,
  run_at        TEXT NOT NULL,
  status        TEXT NOT NULL,
  duration_ms   INTEGER,
  error_msg     TEXT
);

-- Indexes for common queries
CREATE INDEX idx_signals_category_date ON signals(category, date);
CREATE INDEX idx_asset_signals_ticker ON asset_signals(ticker);
CREATE INDEX idx_asset_signals_signal_id ON asset_signals(signal_id);
CREATE INDEX idx_macro_date ON macro_signals(date);
CREATE INDEX idx_run_logs_run_at ON run_logs(run_at);
