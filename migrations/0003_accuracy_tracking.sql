-- migrations/0003_accuracy_tracking.sql
-- Signal accuracy tracking (Task 1)

CREATE TABLE signal_outcomes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id       INTEGER NOT NULL REFERENCES signals(id),
  category        TEXT NOT NULL,
  predicted_bias  TEXT NOT NULL,
  price_at_signal REAL,
  price_after_24h REAL,
  price_change_pct REAL,
  correct         INTEGER,
  checked_at      TEXT NOT NULL
);

-- Events table for analytics tracking (Task 2)
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event       TEXT NOT NULL,
  data_json   TEXT,
  created_at  TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_signal_outcomes_signal_id ON signal_outcomes(signal_id);
CREATE INDEX idx_signal_outcomes_category ON signal_outcomes(category);
CREATE INDEX idx_signal_outcomes_checked_at ON signal_outcomes(checked_at);
CREATE INDEX idx_events_event ON events(event);
CREATE INDEX idx_events_created_at ON events(created_at);
