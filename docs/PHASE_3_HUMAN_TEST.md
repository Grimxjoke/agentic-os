# Phase 3 — human acceptance test

This checklist validates the Phase 3 Agent Lab, versioned teams, bounded run
orchestration, resumable event stream, and real Observatory data as an operator.

## Prerequisites

- Orbit, Vibe-Trading, and the ngrok tunnel are running.
- Vibe reports its engine and provider as ready.
- The browser has an authenticated Orbit session.
- No live trading is expected or allowed during this test.

## 1. Create the agents

Open **Agent Lab** and create three agents using the provider and model displayed
by Vibe:

1. `Market Researcher`
   - role: `Market research analyst`
   - instructions: collect evidence and state uncertainty;
   - tools: `web`;
   - filesystem: `deny`, network: `allow`, trading: `deny`.
2. `Risk Researcher`
   - role: `Risk analyst`
   - instructions: challenge assumptions and list failure modes;
   - tools: `web`;
   - filesystem: `deny`, network: `allow`, trading: `deny`.
3. `Strategy Reviewer`
   - role: `Strategy reviewer`
   - instructions: compare both reports and produce a testable research plan;
   - no tools required;
   - filesystem: `deny`, network: `deny`, trading: `deny`.

Expected result: each card appears in Agent Lab as version 1, and its immutable
version history is visible.

## 2. Build a parallel DAG team

Open **Teams & Runs**, select **New team**, and create `Momentum Research Desk`
with concurrency `2`:

| Node key | Agent | Task | Dependencies |
|---|---|---|---|
| `market_research` | Market Researcher | Identify evidence for and against daily momentum. | none |
| `risk_research` | Risk Researcher | Identify leakage, regime, liquidity, and execution risks. | none |
| `review` | Strategy Reviewer | Synthesize both reports into a falsifiable validation plan. | `market_research`, `risk_research` |

Expected result: the team is saved as version 1. The editor must reject duplicate
node keys, unknown dependencies, self-dependencies, and cyclic dependencies.

## 3. Launch a real research run

Use this objective:

> Evaluate whether a daily momentum hypothesis on BTC/USD deserves a backtest.
> Produce assumptions, required data, leakage controls, risk checks, and explicit
> pass/fail criteria. Do not place orders and do not claim a backtest was run.

Click **Launch** and open the run detail.

Expected result:

- `market_research` and `risk_research` can run in parallel;
- `review` stays queued until both dependencies complete;
- the timeline receives append-only events without duplicates;
- each completed worker exposes its real output;
- tokens and cost show measured values when Vibe reports them, otherwise `—`;
- artifacts appear only when Vibe actually reports one;
- the final run status becomes `Completed`.

## 4. Test stream recovery

Launch another run, refresh the browser while workers are active, and reopen the
same run.

Expected result: the timeline resumes from persisted events, does not duplicate
old entries, and continues receiving new entries.

## 5. Test cancellation

Launch a detailed research objective and click **Cancel** while a worker is active.

Expected result: the run becomes `Canceled`, active work stops, queued work does
not start, and all events already written remain visible.

## 6. Test failure and retry

Create a temporary agent revision with a model name that does not match the model
configured in Vibe, then use it in a one-node team and launch a run.

Expected result: provider/model preflight fails clearly, bounded retries are
visible, and the run ends as `Failed` when its retry budget is exhausted. Click
**Retry** and confirm that the new run references the original immutable snapshot.

## 7. Test immutable history

Revise one agent and then revise the team to use the new agent version. Keep the
old run open in another tab.

Expected result: the old run still shows the original agent/team snapshot, while
new runs use the new versions.

## 8. Test restart recovery

This operator-level scenario requires VPS shell access. Start a run and immediately
restart Orbit:

```bash
sudo systemctl restart orbit-os
systemctl is-active orbit-os vibe-trading ngrok-orbit
npm run check:health
```

Reload the run after Orbit returns.

Expected result: an interrupted worker is reconciled, the run is marked degraded
during recovery, and another attempt starts only if its retry budget permits it.
Existing events must remain available.

## 9. Verify Observatory honesty

Open **Observatory** after completing, canceling, and failing runs.

Expected result: counts, active workers, activity, success/failure distribution,
tokens, and cost are derived from persisted run data. Missing provider metrics are
shown as `—`, never as invented zeroes.

## Phase boundary

Phase 3 orchestrates research agents and captures durable, auditable outputs. It
does not yet create a canonical trading-strategy entity, run a reproducible market
backtest, compare strategy variants, or place paper/live orders. Those workflows
belong to later Strategy Factory and backtest phases. The safe Phase 3 human test
is therefore a strategy-research workflow that produces a validation plan rather
than a claimed trading result.
