# Phase 6 Operations Runbook

## Runtime contract

- Application version: `0.11.0`.
- SQLite schema: `6`.
- Experiment Studio: `/orbit/experiments`.
- CPU backtest concurrency: one slot per Orbit process.
- Canonical evidence remains the SQLite database plus Phase 5 backtest report artifacts.

## Pre-deployment

1. Stop Orbit before taking the pre-migration raw SQLite copy.
2. Copy the explicit database file to a new explicit backup path.
3. Preserve the complete `backtest-artifacts` directory with the database.
4. Deploy the Phase 6 build and start Orbit.
5. Confirm `/orbit/healthz`, `/orbit/readyz`, application version `0.11.0`, and schema version `6`.
6. Run the protected experiment list request without creating production research data.

## Recovery behavior

At startup, Phase 5 first marks interrupted running backtests failed. Phase 6 then returns interrupted evaluating candidates to its queue and resumes queued/running experiments. If a candidate's previous backtest failed, recovery creates a distinct replacement backtest. Completed evaluations are never repeated.

Paused experiments remain paused across restarts. Cancelled, completed, and failed experiments are terminal. A champion remains a research record and grants no authority to trade.

## Operational checks

```bash
npm test
npm run build
curl --fail --silent http://127.0.0.1:4173/orbit/healthz
curl --fail --silent http://127.0.0.1:4173/orbit/readyz
```

Monitor CPU and memory during a real experiment. The queue intentionally executes one backtest at a time on the current host.

## Rollback

1. Stop Orbit.
2. Preserve the current schema-6 database and backtest artifacts for investigation.
3. Restore the explicit pre-Phase-6 SQLite backup and its matching artifacts.
4. Restore the Phase 5 application revision.
5. Start Orbit and verify health, readiness, application version `0.10.0`, and schema version `5`.

A Phase 5 binary does not use the new tables, but application rollback should still restore the matching pre-migration database so code, schema, and artifacts remain an exact set.
