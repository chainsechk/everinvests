-- migrations/0002_agent_workflows.sql

-- Workflow-level observability (one row per category run)
CREATE TABLE workflow_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id    TEXT NOT NULL,
  category       TEXT NOT NULL,
  date           TEXT NOT NULL,
  time_slot      TEXT NOT NULL,
  status         TEXT NOT NULL,
  duration_ms    INTEGER
);

-- Skill-level observability (one row per skill per workflow run)
CREATE TABLE skill_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_run_id INTEGER NOT NULL REFERENCES workflow_runs(id),
  skill_id      TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  status        TEXT NOT NULL,
  duration_ms   INTEGER,
  error_msg     TEXT
);

-- Indexes for common queries
CREATE INDEX idx_workflow_runs_lookup ON workflow_runs(category, date, time_slot);
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_skill_runs_workflow_run ON skill_runs(workflow_run_id);
