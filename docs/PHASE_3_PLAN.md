# Phase 3 — executable technical plan

Status: tranches A to E completed and validated on July 17, 2026.

## Workstream A — versioned agent registry

1. Migrate agent identities and versions to SQLite.
2. Make versions immutable at the base level.
3. Validate definitions, budgets and policies on the server side.
4. Expose list, creation, history and new version via Orbit.
5. Replace Lab Agent `localStorage` with the actual API.
6. Test transactional rollback, immutability, restart and HTTP contracts.

## Workstream B — versioned DAG teams

1. Add team identities, versions, nodes and edges.
2. Implement topological validation and concurrency bounds.
3. Build the editor from Vibe agents and presets.
4. Preview work order, aggregated budgets and errors.
5. Test cycles, stale references and immutable versioning.

## Workstream C — run orchestrator

1. Add runs, workers, attempts and dedicated events.
2. Take a team snapshot at launch.
3. Schedule ready nodes with bounded concurrency.
4. Connect cancel, timeout, retry and reconciliation after restart.
5. Test with a deterministic, costless dummy runtime.

## Slice D — real-time timeline

1. Expose run details and resumeable SSE events.
2. Deduplicate events after reconnection.
3. Show workers, attempts, tools, errors and artifacts.
4. Explicitly distinguish unknown metrics from zeros.
5. Test refresh, restart, interrupted flow and run stale.

## Workstream E — Observatory and production

1. Feed global maps from real runs.
2. Measure tokens, cost, duration and failure rate.
3. Document backup, operation and rollback Phase 3.
4. Run build, tests, migrations and secret scans.
5. Deploy, smoke test, commit, push and open the PR.
