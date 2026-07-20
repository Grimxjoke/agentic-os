# Orbit Continuation Handoff

Last locally verified: **July 20, 2026**

This document is the canonical continuation note for a new Codex session or a
new operator machine. It is intentionally self-contained and contains no
secrets.

## Repository and working rules

- Canonical repository: <https://github.com/Grimxjoke/Orbit-Trading-Agent-OS>
- VPS checkout: `/home/codex/agentic-os`
- Default branch: `main`
- Current development branch: `agent/phase-6-experiment-studio`
- Repository content, documentation, commit messages, branch names, and pull
  requests must be written in English. Conversation with the owner may be in
  French.
- Never commit values from `/etc/agentic-os`, `/etc/vibe-trading`, provider
  credentials, access tokens, cookies, or private runtime data.
- Orbit is single-user and research-first. No paper or live trading route has
  been authorized.

Known language cleanup: `docs/IMPLEMENTATION_PLAN.md` still contains a small
number of legacy French headings and phrases. Translate them without changing
the roadmap semantics before declaring the entire repository English-only.

## Executive status

Phases 0 through 3 are merged into `main`. Phases 4 and 5 are implemented,
tested, pushed, and deployed on the VPS, but they remain stacked draft pull
requests and still need human acceptance and final merge.

| Phase | State | Main result |
|---|---|---|
| 0 | Merged and validated | Secure loopback-only baseline and authenticated public border |
| 1 | Merged and validated | Persistent SQLite control plane, jobs, audit, sessions, migrations, and backup |
| 2 | Merged and validated | Real Vibe-Trading engine, OAuth Codex provider, sessions, SSE, and artifacts |
| 3 | Merged and validated | Versioned agents and teams, DAG runs, policies, retry, cancellation, and observability |
| 4 | Implemented and deployed; draft PR | Bounded files, artifact index, memory, hypotheses, provenance, and knowledge graph |
| 5 | Implemented and deployed; draft PR | Immutable strategies, deterministic datasets, reproducible backtests, validations, comparison, correlation, and Alpha Zoo |
| 6 | Implemented locally; validation/deployment pending | Experiment Studio, bounded generations, candidates, evaluation, recovery, and research champion/challenger |
| 7–10 | Planned only | Automations, paper trading, gated live trading, and design consolidation |

The production deployment currently includes all Phase 5 code even though the
Phase 4 and Phase 5 pull requests are not merged into `main` yet.

Phase 6 was subsequently authorized, implemented, and deployed from the stacked
branch. It adds schema version 6 and application version `0.11.0`; human acceptance
and merge remain pending. The local suite now contains 57 passing Orbit tests.

Public access is protected by ngrok-managed Google OAuth, restricted to
`coinccrypto@gmail.com`. Orbit runs in `ngrok_google` authentication mode and remains
bound to loopback only. The edge policy and recovery procedure are documented in
`docs/GOOGLE_ACCESS_RUNBOOK.md`.

## Git and pull request topology

The last verified remote topology is:

```text
main (Phases 0–3)
└── agent/phase-4-knowledge-files
    └── agent/phase-5-strategy-backtests  ← last documented production checkout
        └── agent/phase-6-experiment-studio  ← local Phase 6 work
```

Relevant pull requests:

| PR | State | Base → head | Purpose |
|---|---|---|---|
| [#4](https://github.com/Grimxjoke/Orbit-Trading-Agent-OS/pull/4) | Merged | `phase-2-vibe-real` → `agent/phase-3-agent-lab-runs` | Complete Phase 3 |
| [#6](https://github.com/Grimxjoke/Orbit-Trading-Agent-OS/pull/6) | Merged | `main` ← `phase-2-vibe-real` | Bring the completed Phase 2/3 stack into `main` |
| [#7](https://github.com/Grimxjoke/Orbit-Trading-Agent-OS/pull/7) | Draft | `agent/phase-3-agent-lab-runs` → `agent/phase-4-knowledge-files` | Phase 4 |
| [#8](https://github.com/Grimxjoke/Orbit-Trading-Agent-OS/pull/8) | Draft | `agent/phase-4-knowledge-files` → `agent/phase-5-strategy-backtests` | Phase 5 |

Implementation checkpoints before this handoff commit:

- Phase 3: `788a65a`
- Phase 4: `e333191`
- Phase 5: `90e6773`

Before merging, refresh remote state and inspect the diff. Because PR #7 still
targets the historical Phase 3 branch, the recommended integration sequence is:

1. Change PR #7 base to `main`, confirm that only Phase 4 changes remain, run
   the suite, mark it ready, and merge it.
2. Rebase or update the Phase 5 branch onto the new `main` if required.
3. Change PR #8 base to `main`, confirm that only Phase 5 changes remain, run
   the suite, mark it ready, and merge it.
4. Do not force-push or rewrite the deployed branch until the production
   checkout and rollback path have been reviewed.

## Phase 5 delivered surface

### Backend and persistence

- SQLite schema version 5 in `server/migrations/005_strategy_backtests.sql`.
- Immutable strategy and strategy-version records.
- Checksummed, seeded, synthetic OHLCV dataset snapshots.
- A deterministic engine with a mandatory completed-bar signal lag.
- Momentum and rolling z-score mean-reversion templates.
- Cost- and slippage-aware equity, trades, metrics, and reports.
- Static checks, Monte Carlo drawdown, bootstrap Sharpe, and five-fold
  walk-forward validation.
- Checksummed reports under
  `$ORBIT_DATA_DIR/backtest-artifacts/<backtest-id>/report.json`.
- Compatibility checks for comparisons and return-correlation matrices.
- Explicit Alpha Zoo states: `available`, `research`, and `planned`.
- Strategy and backtest lineage in the knowledge graph.

### User interface

- Strategy Factory: `/orbit/strategies`
- Backtests: `/orbit/backtests`
- Compare: `/orbit/compare`
- Correlation: `/orbit/correlation`
- Alpha Zoo: `/orbit/alpha-zoo`

### Important API routes

```text
GET  /orbit/api/strategies
POST /orbit/api/strategies/generate
GET  /orbit/api/strategies/:id/versions
POST /orbit/api/strategies/:id/versions
GET  /orbit/api/datasets
POST /orbit/api/datasets/synthetic
GET  /orbit/api/backtests
POST /orbit/api/backtests
GET  /orbit/api/backtests/:id
POST /orbit/api/backtests/compare
POST /orbit/api/backtests/correlation
GET  /orbit/api/alpha-zoo
```

## Validation already completed

- `npm test`: **49 of 49 tests passed**.
- `npm run build`: TypeScript and Vite production build passed.
- Deterministic tests run without network access.
- Lookahead, malformed chronology, corrupted OHLC, incompatible comparisons,
  missing reports, and corrupted reports fail closed or surface explicitly.
- The pushed working tree was clean after commit `90e6773`.
- Protected production smoke tests confirmed application version `0.10.0`,
  database schema version `5`, the Phase 5 list endpoints, and all three Alpha
  Zoo states.
- No synthetic strategy, dataset, or backtest was inserted into the production
  database during deployment smoke testing.

Human acceptance is still worth doing before merging. Use:

- [Phase 4 human validation](PHASE_4_HUMAN_TEST.md)
- [Phase 5 human validation](PHASE_5_HUMAN_TEST.md)

## Current VPS deployment

### Runtime state

At the handoff timestamp, these services were `active (running)`:

- `orbit-os.service`
- `vibe-trading.service`
- `ngrok-orbit.service`

Both internal probes returned success:

```text
GET http://127.0.0.1:4173/orbit/healthz → alive
GET http://127.0.0.1:4173/orbit/readyz  → ready
```

Runtime facts:

| Item | Value |
|---|---|
| Checkout | `/home/codex/agentic-os` |
| Production branch | `agent/phase-5-strategy-backtests` |
| Application version | `0.10.0` |
| SQLite schema | `5` |
| Orbit bind address | `127.0.0.1:4173` |
| Orbit data directory | `/var/lib/orbit-os` |
| SQLite database | `/var/lib/orbit-os/orbit.sqlite` |
| Orbit unit | `/etc/systemd/system/orbit-os.service` |
| Orbit environment | `/etc/agentic-os/orbit.env` |

The environment file is sensitive. Source it only in a process that does not
print its values. Never paste its contents into a Codex conversation or logs.

### Recovery backups

Known pre-migration backups:

```text
/var/lib/orbit-os/backups/orbit-pre-phase4-2026-07-17T14-18-43Z.sqlite
/var/lib/orbit-os/backups/orbit-pre-phase5-2026-07-17T14-47-26Z.sqlite
```

The Phase 5 backup was made after stopping Orbit and before applying migration
5. It is the primary database rollback point for Phase 5. Preserve the
`backtest-artifacts` directory together with SQLite once real research runs
exist.

### Safe read-only checks

```bash
cd /home/codex/agentic-os
git status -sb
git fetch origin --prune
git log --oneline --decorate -8
gh pr list --repo Grimxjoke/Orbit-Trading-Agent-OS --state open

sudo systemctl is-active orbit-os vibe-trading ngrok-orbit
curl --fail --silent --show-error http://127.0.0.1:4173/orbit/healthz
curl --fail --silent --show-error http://127.0.0.1:4173/orbit/readyz
sudo journalctl -u orbit-os -n 100 --no-pager
```

Do not run the database backup command from an older checkout before deciding
whether migrations are acceptable: opening the database may apply forward
migrations. For a pre-migration raw SQLite backup, stop Orbit first and copy the
explicit database path to a new explicit backup path.

## Recommended next session

The safest next goal is **accept and integrate Phases 4 and 5**, not to begin
Phase 6 immediately.

1. Read this handoff, `README.md`, `docs/ARCHITECTURE_MAP.md`, and the Phase 4/5
   plan, runbook, and human-test documents.
2. Verify GitHub and VPS state with the read-only commands above.
3. Perform the Phase 4 and Phase 5 human acceptance flows in the dashboard.
4. Translate the remaining legacy French fragments in
   `docs/IMPLEMENTATION_PLAN.md` without changing roadmap meaning.
5. Record any defects as English commits on the appropriate stacked branch.
6. Run `npm test` and `npm run build` after fixes.
7. Integrate PR #7 and then PR #8 using the sequence in this document.
8. Confirm production remains on the expected commit after integration.
9. Only then write the Phase 6 PRD/plan and define its deterministic experiment
   contracts before implementation.

Phase 6 must not silently promote any candidate to paper or live trading. It
should introduce durable experiments, generations, candidates, evaluations,
budgets, pause/recovery, and champion/challenger research semantics only.

## Copy/paste prompt for another Codex

```text
Continue development of Orbit Trading Agent OS from the repository handoff.
Work on the VPS checkout at /home/codex/agentic-os and read
docs/CONTINUATION_HANDOFF.md completely before making changes. Verify Git,
GitHub PRs, systemd services, health probes, and the current database schema
using read-only checks first. The repository and every commit/PR must remain in
English, although you may speak French with me. Preserve all secrets and user
data. Phases 0–3 are merged; Phase 4 PR #7 and Phase 5 PR #8 are implemented,
deployed, and stacked drafts. First help me human-test and safely integrate P4
then P5. Do not start Phase 6 or enable paper/live trading without explicit
approval.
```

## Source documents

- [Product PRD](PRD.md)
- [Architecture map](ARCHITECTURE_MAP.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Phase 4 plan](PHASE_4_PLAN.md)
- [Phase 4 runbook](PHASE_4_RUNBOOK.md)
- [Phase 5 plan](PHASE_5_PLAN.md)
- [Phase 5 runbook](PHASE_5_RUNBOOK.md)
- [Phase 5 human validation](PHASE_5_HUMAN_TEST.md)
