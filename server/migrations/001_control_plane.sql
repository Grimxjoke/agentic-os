CREATE TABLE access_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;

CREATE INDEX access_sessions_active_idx
  ON access_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL CHECK (agent IN ('pi', 'codex')),
  title TEXT NOT NULL,
  runtime_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE INDEX conversations_agent_updated_idx
  ON conversations(agent, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  mode TEXT NOT NULL CHECK (mode IN ('plan', 'build')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX messages_conversation_created_idx
  ON messages(conversation_id, created_at, id);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  title TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
) STRICT;

CREATE INDEX jobs_status_created_idx ON jobs(status, created_at DESC);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX events_created_idx ON events(created_at DESC, id DESC);
CREATE INDEX events_job_idx ON events(job_id, id);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  risk TEXT NOT NULL CHECK (risk IN ('A', 'B', 'C', 'D')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
) STRICT;

CREATE INDEX decisions_status_created_idx ON decisions(status, created_at DESC);

CREATE TABLE audit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX audit_created_idx ON audit_entries(created_at DESC, id DESC);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
