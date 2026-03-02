-- Codebase run execution tables (Cloudflare Containers MVP)

CREATE TABLE IF NOT EXISTS codebase_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  repo_full_name TEXT,
  base_branch TEXT NOT NULL,
  target_branch TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled', 'timed_out')),
  requested_commands_json TEXT NOT NULL,
  command_allowlist_version TEXT NOT NULL,
  timeout_seconds INTEGER NOT NULL DEFAULT 600,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  canceled_at TEXT,
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_codebase_runs_user_created ON codebase_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_codebase_runs_status ON codebase_runs (status);

CREATE TABLE IF NOT EXISTS codebase_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('system', 'info', 'warn', 'error')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES codebase_runs(id) ON DELETE CASCADE,
  UNIQUE (run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_codebase_run_events_run_seq ON codebase_run_events (run_id, seq);

CREATE TABLE IF NOT EXISTS codebase_run_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER,
  sha256 TEXT,
  url TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES codebase_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_codebase_run_artifacts_run ON codebase_run_artifacts (run_id);
