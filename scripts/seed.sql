-- scripts/seed.sql
-- Sample data for local development

-- Macro signals
INSERT INTO macro_signals (date, time_slot, generated_at, dxy_bias, vix_level, yields_bias, overall)
VALUES
  ('2026-01-14', '08:00', '2026-01-14T08:00:00Z', 'weak', 'risk_on', 'falling', 'Risk-on'),
  ('2026-01-13', '08:00', '2026-01-13T08:00:00Z', 'neutral', 'neutral', 'stable', 'Mixed');

-- Crypto signals
INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, output_json)
VALUES
  ('crypto', '2026-01-14', '08:00', '2026-01-14T08:00:05Z', 'Bullish', 1,
   '{"summary":"BTC and ETH holding above 20D MA with healthy funding rates.","levels":{"btc_support":95000,"btc_resistance":100000},"risks":["Elevated funding could trigger squeeze"]}'),
  ('crypto', '2026-01-13', '08:00', '2026-01-13T08:00:05Z', 'Neutral', 2,
   '{"summary":"Consolidation continues with mixed signals.","levels":{"btc_support":92000,"btc_resistance":98000},"risks":["Weekend liquidity thin"]}');

-- Crypto asset signals
INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind)
VALUES
  (1, 'BTC', 'Bullish', 98500, 'above', '0.008'),
  (1, 'ETH', 'Bullish', 3850, 'above', '0.005'),
  (2, 'BTC', 'Neutral', 95200, 'above', '0.015'),
  (2, 'ETH', 'Neutral', 3720, 'below', '0.012');

-- Forex signals
INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, output_json)
VALUES
  ('forex', '2026-01-14', '08:00', '2026-01-14T08:00:10Z', 'Bearish', 1,
   '{"summary":"USD weakness continues across major pairs.","risks":["Fed speakers this week"]}');

-- Forex asset signals
INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind)
VALUES
  (3, 'USD/JPY', 'Bearish', 148.50, 'below', '42'),
  (3, 'EUR/USD', 'Bullish', 1.0850, 'above', '58'),
  (3, 'USD/CAD', 'Bearish', 1.3420, 'below', '38'),
  (3, 'USD/AUD', 'Bearish', 1.5200, 'below', '45');

-- Stocks signals
INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, output_json)
VALUES
  ('stocks', '2026-01-14', '17:00', '2026-01-14T17:00:15Z', 'Bullish', 1,
   '{"summary":"Semis and AI infra leading on strong earnings outlook.","risks":["Geopolitical tensions","Tariff concerns"]}');

-- Stocks asset signals (sample of 25 tickers)
INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind)
VALUES
  (4, 'NVDA', 'Bullish', 142.50, 'above', '62'),
  (4, 'AMD', 'Bullish', 128.30, 'above', '58'),
  (4, 'AVGO', 'Bullish', 185.20, 'above', '55'),
  (4, 'TSM', 'Bullish', 198.40, 'above', '60'),
  (4, 'ASML', 'Neutral', 725.00, 'above', '48'),
  (4, 'MSFT', 'Bullish', 425.80, 'above', '54'),
  (4, 'GOOGL', 'Neutral', 178.20, 'below', '46'),
  (4, 'AMZN', 'Bullish', 198.50, 'above', '52'),
  (4, 'META', 'Bullish', 585.30, 'above', '58'),
  (4, 'AAPL', 'Neutral', 232.10, 'below', '44');

-- Run logs
INSERT INTO run_logs (category, time_slot, run_at, status, duration_ms)
VALUES
  ('crypto', '08:00', '2026-01-14T08:00:05Z', 'success', 2500),
  ('forex', '08:00', '2026-01-14T08:00:10Z', 'success', 3200),
  ('stocks', '17:00', '2026-01-14T17:00:15Z', 'success', 8500);
