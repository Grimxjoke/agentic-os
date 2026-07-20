CREATE TABLE experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  base_strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  dataset_snapshot_id TEXT NOT NULL REFERENCES dataset_snapshots(id) ON DELETE RESTRICT,
  config_json TEXT NOT NULL,
  budget_json TEXT NOT NULL,
  score_json TEXT NOT NULL,
  lessons_json TEXT NOT NULL DEFAULT '[]',
  champion_candidate_id TEXT,
  generations_completed INTEGER NOT NULL DEFAULT 0 CHECK (generations_completed >= 0),
  candidates_evaluated INTEGER NOT NULL DEFAULT 0 CHECK (candidates_evaluated >= 0),
  backtests_used INTEGER NOT NULL DEFAULT 0 CHECK (backtests_used >= 0),
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  cost_usd REAL NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  best_score REAL,
  patience_used INTEGER NOT NULL DEFAULT 0 CHECK (patience_used >= 0),
  pause_requested_at TEXT,
  cancel_requested_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  finished_at TEXT
) STRICT;

CREATE INDEX experiments_status_created_idx ON experiments(status, created_at DESC);

CREATE TABLE experiment_generations (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number > 0),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  seed_candidate_id TEXT,
  champion_candidate_id TEXT,
  lessons_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE(experiment_id, number)
) STRICT;

CREATE INDEX experiment_generations_experiment_idx ON experiment_generations(experiment_id, number);

CREATE TABLE experiment_candidates (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  generation_id TEXT NOT NULL REFERENCES experiment_generations(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  parent_candidate_id TEXT REFERENCES experiment_candidates(id) ON DELETE SET NULL,
  strategy_id TEXT REFERENCES strategies(id) ON DELETE RESTRICT,
  strategy_version_id TEXT REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  backtest_id TEXT REFERENCES backtests(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'queued', 'evaluating', 'completed', 'failed', 'eliminated')),
  parameters_json TEXT NOT NULL,
  score REAL,
  eligible INTEGER NOT NULL DEFAULT 0 CHECK (eligible IN (0, 1)),
  reason TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE(generation_id, ordinal)
) STRICT;

CREATE INDEX experiment_candidates_generation_idx ON experiment_candidates(generation_id, ordinal);
CREATE INDEX experiment_candidates_experiment_score_idx ON experiment_candidates(experiment_id, eligible, score DESC);

CREATE TABLE experiment_evaluations (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL UNIQUE REFERENCES experiment_candidates(id) ON DELETE CASCADE,
  backtest_id TEXT NOT NULL REFERENCES backtests(id) ON DELETE RESTRICT,
  score REAL,
  eligible INTEGER NOT NULL CHECK (eligible IN (0, 1)),
  metrics_json TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE experiment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  generation_id TEXT REFERENCES experiment_generations(id) ON DELETE CASCADE,
  candidate_id TEXT REFERENCES experiment_candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX experiment_events_experiment_idx ON experiment_events(experiment_id, id);
