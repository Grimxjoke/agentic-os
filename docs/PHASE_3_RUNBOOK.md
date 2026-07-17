# Phase 3 — Agent Lab and Runs runbook

## 1. Perimeter

Phase 3 adds to the Orbit control plane:

- agents and teams versioned in an immutable way;
- DAGs validated on the server side, maximum concurrency of two workers;
- runs, workers, attempts, events and persistent artifact references;
- private execution by Vibe, cancellation, retry and recovery after restart;
- resumable SSE timeline and Observatory powered by real data.

Trading remains prohibited. Vibe private roads are transformed into references
opaque before exposure to the browser.

## 2. Canonical data

The `003_teams_and_runs.sql` migration creates:

- `teams` and `team_versions`;
- `runs`, `run_workers`, and `run_events`;
- `run_artifacts`.

Team versions are immutable and run events append-only via
SQLite triggers. The snapshots contain the exact version of each agent.

## 3. Deployment

1. Check that the worktree is clean and that the expected branch is checkout.
2. Run `npm test`.
3. Create a consistent backup in the actual data directory
declared by systemd. On the current VPS:
   `sudo env ORBIT_DATA_DIR=/var/lib/orbit-os npm run db:backup`.
4. Run `npm run db:migrate` or restart Orbit, which applies the migrations
forward-only at startup.
5. Restart `orbit-os.service`.
6. Check `/healthz`, `/readyz`, `/api/system/overview`, `/api/agents`,
`/api/teams`, `/api/runs` and `/api/observatory` via the authenticated border.
7. Verify that Vibe remains loopback-only and ready.

## 4. Deterministic smoke test

The costless smoke test uses a dummy executor and checks:

1. creation of an agent;
2. creation of a two-node team;
3. refusal of a cycle;
4. start and end of the run;
5. SSE relay without duplicate;
6. tokens, cost and artifacts measured;
7. retry from the initial snapshot;
8. Observatory aggregates.

The actual LLM smoke test must remain minimal: a small team, a short objective,
no writing tools and explicit deletion of test sessions on the Vibe side.

## 5. Recovery and incidents

- At startup, any `running` worker is marked failed with a restart cause.
- A new attempt is queued if the retries budget allows it.
- The run passes `degraded`, then the orchestrator takes the available branches.
- If the budget is exhausted, the run becomes `failed` without deleting the events.
- An absence of provider metric remains `null` and is displayed “—”.
- An SSE disconnection resumes from `Last-Event-ID`.

## 6. Rollback

1. Stop `orbit-os.service`.
2. Restore the previous application commit.
3. Keep schema v3: old versions of Orbit ignore new ones
tables and no destructive migration is necessary.
4. If Phase 3 data also needs to return to the previous state, restore
the SQLite backup carried out before deployment.
5. Restart Orbit and check health/readiness.

Never manually remove `run_events`, `agent_versions` or
`team_versions`. Any future purges must be explicit, previewed and audited.
