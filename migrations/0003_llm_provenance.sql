-- migrations/0003_llm_provenance.sql
-- LLM provenance tracking for prompt versioning and run observability

-- Versioned prompt templates
CREATE TABLE prompt_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  template      TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  UNIQUE(name, version)
);

-- LLM run tracking (one row per summary generation)
CREATE TABLE llm_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id         INTEGER REFERENCES signals(id),
  prompt_version_id INTEGER REFERENCES prompt_versions(id),
  model             TEXT NOT NULL,
  tokens_in         INTEGER,
  tokens_out        INTEGER,
  latency_ms        INTEGER,
  status            TEXT NOT NULL,
  error_msg         TEXT,
  fallback_reason   TEXT,
  created_at        TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_prompt_versions_name ON prompt_versions(name);
CREATE INDEX idx_llm_runs_signal ON llm_runs(signal_id);
CREATE INDEX idx_llm_runs_prompt_version ON llm_runs(prompt_version_id);
CREATE INDEX idx_llm_runs_model ON llm_runs(model);
CREATE INDEX idx_llm_runs_status ON llm_runs(status);
CREATE INDEX idx_llm_runs_created ON llm_runs(created_at);
