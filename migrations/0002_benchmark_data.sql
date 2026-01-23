-- migrations/0002_benchmark_data.sql
-- Benchmark ETF data for relative strength calculations (Tier 2 IC)
-- Fetched once daily at 14:00 UTC, before stocks update at 17:00

CREATE TABLE IF NOT EXISTS benchmark_data (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker        TEXT NOT NULL,           -- SPY, XLK, XLE
  date          TEXT NOT NULL,           -- YYYY-MM-DD
  price         REAL NOT NULL,
  ma20          REAL NOT NULL,
  fetched_at    TEXT NOT NULL,           -- ISO timestamp
  UNIQUE(ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_ticker_date ON benchmark_data(ticker, date DESC);
