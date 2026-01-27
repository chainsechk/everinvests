-- Polymarket prediction market data for regime detection (Phase 5)
-- Stores aggregated sentiment from prediction markets

CREATE TABLE IF NOT EXISTS prediction_markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  crypto_bullish REAL NOT NULL,      -- 0-100, aggregated bullish probability for crypto markets
  fed_dovish REAL NOT NULL,          -- 0-100, probability of Fed dovishness
  recession_odds REAL NOT NULL,      -- 0-100, recession probability
  avg_volatility REAL NOT NULL,      -- 0-100, average volatility across markets
  top_markets TEXT NOT NULL,         -- JSON array of top 3 markets with probabilities
  markets_count INTEGER NOT NULL,    -- Number of relevant markets found
  fetched_at TEXT NOT NULL,
  UNIQUE(date, time_slot)
);
