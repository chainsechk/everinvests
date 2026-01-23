-- migrations/0008_analytics_events.sql
-- Simple server-side analytics events (conversion + share tracking)

CREATE TABLE IF NOT EXISTS analytics_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event       TEXT NOT NULL,
  category    TEXT,
  source      TEXT,
  page_path   TEXT,
  referer     TEXT,
  user_agent  TEXT,
  ip_prefix   TEXT,
  meta_json   TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category ON analytics_events(category);
CREATE INDEX IF NOT EXISTS idx_analytics_events_source ON analytics_events(source);
