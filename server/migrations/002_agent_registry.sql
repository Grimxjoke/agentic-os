CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  current_version_id TEXT REFERENCES agent_versions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE TABLE agent_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tools_json TEXT NOT NULL DEFAULT '[]',
  skills_json TEXT NOT NULL DEFAULT '[]',
  budget_json TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('cyan', 'violet', 'rose', 'amber')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (agent_id, version)
) STRICT;

CREATE INDEX agents_updated_idx
  ON agents(updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX agent_versions_agent_idx
  ON agent_versions(agent_id, version DESC);

CREATE TRIGGER agent_versions_immutable_update
BEFORE UPDATE ON agent_versions
BEGIN
  SELECT RAISE(ABORT, 'agent versions are immutable');
END;

CREATE TRIGGER agent_versions_immutable_delete
BEFORE DELETE ON agent_versions
BEGIN
  SELECT RAISE(ABORT, 'agent versions are immutable');
END;
