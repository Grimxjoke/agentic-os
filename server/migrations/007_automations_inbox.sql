CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  definition_json TEXT NOT NULL,
  schedule_json TEXT,
  next_run_at TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX workflows_due_idx ON workflows(status, next_run_at);

CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('manual', 'schedule', 'recovery')),
  occurrence_key TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE(workflow_id, occurrence_key)
) STRICT;

CREATE INDEX workflow_runs_workflow_created_idx ON workflow_runs(workflow_id, created_at DESC);
CREATE INDEX workflow_runs_status_idx ON workflow_runs(status, created_at);

CREATE TABLE workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  branch_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'waiting', 'completed', 'failed', 'skipped')),
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE(workflow_run_id, node_id, branch_key)
) STRICT;

CREATE INDEX workflow_steps_run_status_idx ON workflow_steps(workflow_run_id, status);

CREATE TABLE inbox_requests (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  workflow_step_id TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  risk TEXT NOT NULL CHECK (risk IN ('A', 'B', 'C', 'D')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  expires_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
) STRICT;

CREATE INDEX inbox_requests_status_expiry_idx ON inbox_requests(status, expires_at, created_at DESC);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT
) STRICT;
