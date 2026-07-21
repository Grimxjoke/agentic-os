# Phase 5 Operations Runbook

## Canonical data

- Strategy definitions, datasets, runs, metrics, and validations: `$ORBIT_DATA_DIR/orbit.sqlite`
- Durable reports: `$ORBIT_DATA_DIR/backtest-artifacts/<backtest-id>/report.json`

Report files are mode `0600`. Their checksums are stored in SQLite and verified whenever Run Detail is opened.

## Deployment

1. Stop Orbit and create a consistent pre-migration database backup.
2. Deploy the production build.
3. Run `npm run db:migrate`; expected schema: version 5.
4. Restart Orbit.
5. Verify liveness and readiness.
6. Generate one strategy, one seeded dataset, and one backtest.
7. Confirm all four validation records and an `available` report artifact.

## Diagnostics

- `lookahead_risk`: signal lag is zero, or timestamps are not strictly increasing.
- `corrupted_dataset`: OHLC values are missing, non-finite, or invalid.
- `invalid_strategy_config`: template parameters violate their ordering or bounds.
- `incompatible_comparison`: dataset checksum or cost assumptions differ.
- report `missing`: SQLite completed the run but the report file is absent.
- report `corrupted`: the report content no longer matches its recorded checksum.

Missing or corrupted reports do not rewrite historical metrics. Restore the report from backup or rerun the exact immutable strategy and dataset as a distinct backtest.

## Recovery and rollback

Running backtests are marked failed after a restart; they are never silently presented as completed. Schema v5 is additive. A Phase 4 binary can ignore the new tables, but preserve both the SQLite database and `backtest-artifacts` directory during rollback.
