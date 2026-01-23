-- G5 Enhancement: GDELT Headlines and Spike Detection
-- Adds columns for top headlines and spike ratio vs 7-day baseline

ALTER TABLE gdelt_scores ADD COLUMN top_headlines TEXT DEFAULT '[]';
ALTER TABLE gdelt_scores ADD COLUMN spike_ratio REAL DEFAULT 1.0;
