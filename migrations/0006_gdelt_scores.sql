-- Phase 4 Regime Detection: GDELT Geopolitical Scores
-- Stores daily geopolitical tension metrics from GDELT API

CREATE TABLE IF NOT EXISTS gdelt_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  score INTEGER NOT NULL,              -- 0-100 tension score
  trend TEXT NOT NULL,                 -- rising, stable, falling
  top_threats TEXT NOT NULL,           -- JSON array of keywords
  articles INTEGER NOT NULL,           -- number of matching articles
  avg_tone REAL NOT NULL,              -- average article tone
  fetched_at TEXT NOT NULL,            -- ISO timestamp
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_gdelt_scores_date ON gdelt_scores(date DESC);
