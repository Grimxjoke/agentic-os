CREATE TABLE file_backups (
  id TEXT PRIMARY KEY,
  root_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX file_backups_path_idx ON file_backups(root_id, relative_path, created_at DESC);

CREATE TABLE artifact_index (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'run')),
  source_id TEXT NOT NULL,
  root_id TEXT,
  relative_path TEXT,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime_type TEXT,
  bytes INTEGER,
  checksum TEXT,
  searchable_text TEXT NOT NULL DEFAULT '',
  indexed_at TEXT NOT NULL,
  UNIQUE(source_type, source_id)
) STRICT;

CREATE INDEX artifact_index_name_idx ON artifact_index(name, indexed_at DESC);
CREATE INDEX artifact_index_run_idx ON artifact_index(run_id, indexed_at DESC);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact', 'preference', 'decision', 'learning')),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'run', 'agent', 'hypothesis', 'manual')),
  source_id TEXT,
  source_uri TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE INDEX memories_updated_idx ON memories(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX memories_source_idx ON memories(source_type, source_id) WHERE archived_at IS NULL;

CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'testing', 'supported', 'rejected', 'inconclusive')),
  tags_json TEXT NOT NULL DEFAULT '[]',
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'run', 'agent', 'memory', 'manual')),
  source_id TEXT,
  source_uri TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE INDEX hypotheses_updated_idx ON hypotheses(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX hypotheses_status_idx ON hypotheses(status, updated_at DESC) WHERE archived_at IS NULL;
