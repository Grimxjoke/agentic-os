# Phase 6 Human Acceptance Test

## Preconditions

- Phase 5 human acceptance has passed.
- Orbit reports application version `0.11.0` and SQLite schema `6`.
- At least one immutable strategy and one deterministic dataset exist.
- The operator has confirmed that no broker or trading mandate is enabled for this test.

## Experiment flow

1. Open **Experiment Studio**.
2. Create an experiment with two generations, three candidates per generation, and six maximum backtests.
3. Select a base strategy, fixed dataset, Sharpe score, minimum trades, and maximum drawdown.
4. Confirm the experiment starts in `draft` and all budget snapshots are visible.
5. Start it and observe one CPU backtest at a time.
6. Pause during evaluation, wait for the current bounded transition, and confirm the state becomes `paused`.
7. Restart Orbit while paused and confirm it remains paused.
8. Resume and wait for completion.

## Evidence checks

- Exactly two generations and no more than six backtests exist.
- Each candidate links to an immutable strategy version and reproducible backtest.
- Ineligible candidates display their constraint reason.
- The generation champion and next-generation parent lineage are visible.
- The transition log survives a browser refresh and Orbit restart.
- The global champion is labelled research-only.
- The UI explicitly says paper promotion and live promotion are disabled.
- No order, broker, paper account, live mandate, or allocation was created.

## Control checks

- A paused experiment can resume once without duplicating completed evaluations.
- A cancelled draft experiment becomes terminal without running a backtest.
- Invalid budgets and unknown strategy/dataset identifiers are rejected.
- A completed experiment cannot be started again.

## Acceptance boundary

Phase 6 is accepted when the flow is durable, bounded, reproducible, and produces only a research champion. Scheduling, exceptional Human Inbox decisions, paper trading, and live trading remain outside this phase.
