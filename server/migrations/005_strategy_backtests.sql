CREATE TABLE strategies (
  id TEXT PRIMARY KEY,
  current_version_id TEXT REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  hypothesis_id TEXT REFERENCES hypotheses(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE TABLE strategy_versions (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  thesis TEXT NOT NULL,
  template TEXT NOT NULL CHECK (template IN ('momentum', 'mean_reversion')),
  code TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(strategy_id, version)
) STRICT;

CREATE INDEX strategies_updated_idx ON strategies(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX strategy_versions_strategy_idx ON strategy_versions(strategy_id, version DESC);

CREATE TRIGGER strategy_versions_immutable_update
BEFORE UPDATE ON strategy_versions
BEGIN
  SELECT RAISE(ABORT, 'strategy versions are immutable');
END;

CREATE TRIGGER strategy_versions_immutable_delete
BEFORE DELETE ON strategy_versions
BEGIN
  SELECT RAISE(ABORT, 'strategy versions are immutable');
END;

CREATE TABLE dataset_snapshots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('synthetic', 'fixture', 'upload')),
  symbol TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  rows INTEGER NOT NULL CHECK (rows > 2),
  checksum TEXT NOT NULL UNIQUE,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX dataset_snapshots_created_idx ON dataset_snapshots(created_at DESC);

CREATE TABLE backtests (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE RESTRICT,
  strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  hypothesis_id TEXT REFERENCES hypotheses(id) ON DELETE SET NULL,
  dataset_snapshot_id TEXT NOT NULL REFERENCES dataset_snapshots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  config_json TEXT NOT NULL,
  strategy_snapshot_json TEXT NOT NULL,
  data_snapshot_json TEXT NOT NULL,
  metrics_json TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  equity_json TEXT,
  returns_json TEXT,
  trades_json TEXT,
  artifact_uri TEXT,
  artifact_checksum TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
) STRICT;

CREATE INDEX backtests_status_created_idx ON backtests(status, created_at DESC);
CREATE INDEX backtests_strategy_created_idx ON backtests(strategy_id, created_at DESC);
CREATE INDEX backtests_hypothesis_idx ON backtests(hypothesis_id, created_at DESC);

CREATE TABLE backtest_validations (
  id TEXT PRIMARY KEY,
  backtest_id TEXT NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('static', 'bootstrap', 'monte_carlo', 'walk_forward')),
  status TEXT NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  summary TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE(backtest_id, kind)
) STRICT;

CREATE INDEX backtest_validations_run_idx ON backtest_validations(backtest_id, kind);
