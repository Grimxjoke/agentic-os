CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  current_version_id TEXT REFERENCES team_versions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE TABLE team_versions (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL CHECK (max_concurrency BETWEEN 1 AND 2),
  nodes_json TEXT NOT NULL,
  budget_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (team_id, version)
) STRICT;

CREATE INDEX teams_updated_idx ON teams(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX team_versions_team_idx ON team_versions(team_id, version DESC);

CREATE TRIGGER team_versions_immutable_update
BEFORE UPDATE ON team_versions
BEGIN
  SELECT RAISE(ABORT, 'team versions are immutable');
END;

CREATE TRIGGER team_versions_immutable_delete
BEFORE DELETE ON team_versions
BEGIN
  SELECT RAISE(ABORT, 'team versions are immutable');
END;

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  team_version_id TEXT NOT NULL REFERENCES team_versions(id) ON DELETE RESTRICT,
  retry_of_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'degraded', 'completed', 'failed', 'cancelled')),
  objective TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL CHECK (max_concurrency BETWEEN 1 AND 2),
  total_workers INTEGER NOT NULL CHECK (total_workers > 0),
  completed_workers INTEGER NOT NULL DEFAULT 0 CHECK (completed_workers >= 0),
  tokens_used INTEGER,
  cost_usd REAL,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  cancel_requested_at TEXT
) STRICT;

CREATE INDEX runs_status_created_idx ON runs(status, created_at DESC);
CREATE INDEX runs_team_created_idx ON runs(team_id, created_at DESC);

CREATE TABLE run_workers (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  agent_version_id TEXT NOT NULL REFERENCES agent_versions(id) ON DELETE RESTRICT,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
  session_id TEXT,
  output_json TEXT,
  error TEXT,
  tokens_used INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (run_id, node_key, attempt)
) STRICT;

CREATE INDEX run_workers_run_idx ON run_workers(run_id, node_key, attempt DESC);
CREATE INDEX run_workers_status_idx ON run_workers(status, created_at);

CREATE TABLE run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES run_workers(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX run_events_run_idx ON run_events(run_id, id);

CREATE TRIGGER run_events_append_only_update
BEFORE UPDATE ON run_events
BEGIN
  SELECT RAISE(ABORT, 'run events are append-only');
END;

CREATE TRIGGER run_events_append_only_delete
BEFORE DELETE ON run_events
BEGIN
  SELECT RAISE(ABORT, 'run events are append-only');
END;

CREATE TABLE run_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES run_workers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  uri TEXT NOT NULL,
  bytes INTEGER,
  checksum TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX run_artifacts_run_idx ON run_artifacts(run_id, created_at);
