# Phase 6 Plan — Experiment Studio

## Outcome

Phase 6 turns the Phase 5 backtester into a durable, bounded research loop. An operator can create an experiment, evaluate deterministic candidates over successive generations, pause or resume the loop, and inspect a champion/challenger trail. A champion is evidence for further research only. Phase 6 has no paper or live promotion route.

## Delivered vertical slices

### Durable experiment model

- SQLite schema version 6 for experiments, generations, candidates, evaluations, and events.
- Immutable strategy and dataset references plus explicit backtest, budget, and score snapshots.
- Durable counters for completed generations, evaluated candidates, and consumed backtests.
- Candidate lineage from the prior generation champion.

### Bounded deterministic loop

- Deterministic momentum or mean-reversion parameter variants.
- Configurable generation, candidates-per-generation, and global backtest ceilings.
- A single-slot CPU queue separate from the Phase 3 LLM worker concurrency.
- Stable ranking by score and candidate ordinal for exact ties.
- Fail-closed rejection of missing, non-finite, under-traded, or over-drawn evaluations.

### Recovery and control

- Start, pause, resume, and cancel contracts.
- Interrupted evaluating candidates return to the queue after a control-plane restart.
- Existing completed candidate transitions are not repeated.
- A failed interrupted backtest is replaced by a distinct backtest record; historical evidence is not rewritten.
- Generation lessons seed the next generation and remain visible in the durable log.

### Product surface

- Experiment Studio at `/orbit/experiments`.
- Create form with strategy, dataset, budgets, score, and validation constraints.
- Generation/candidate cards, champion score, budget counters, and transition log.
- Permanent research boundary showing paper and live promotion as disabled.

## API contract

```text
GET  /orbit/api/experiments
POST /orbit/api/experiments
GET  /orbit/api/experiments/:id
POST /orbit/api/experiments/:id/start
POST /orbit/api/experiments/:id/pause
POST /orbit/api/experiments/:id/resume
POST /orbit/api/experiments/:id/cancel
```

## Non-goals

- No arbitrary strategy code execution.
- No parallel CPU backtests on the current two-vCPU host.
- No automatic Vibe/LLM candidate generation in the deterministic baseline.
- No scheduled automation or Human Inbox workflow; those belong to Phase 7.
- No paper broker, live broker, order, allocation, or promotion endpoint.

## Exit criteria

- Schema version 6 is idempotent and survives reopen/backup.
- Two generations with three variants complete deterministically.
- Global backtest budgets cannot be exceeded.
- Incomplete metrics, ties, and NaN scores behave deterministically and fail closed.
- Restart recovery is idempotent at candidate transitions.
- Protected API and production UI build pass.
- Completed events explicitly record `paperPromoted: false` and `livePromoted: false`.
