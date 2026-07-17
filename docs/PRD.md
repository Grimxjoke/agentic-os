# PRD — Orbit Trading Agent OS

Framing version: 1.0. Single-user product for Paul.

## 1. Vision

Orbit is the cockpit from which a single operator creates, launches, observes and improves teams of trading agents. Agents must be able to research, generate policies, backtest, compare, document and execute workflows with strong autonomy. The user intervenes to set the intention, budgets and limits, not to approve every ordinary step.

## 2. Expected result

From the interface, the user must be able to:

1. describe a trading objective in natural language;
2. create or choose a team of agents and their skills;
3. launch several variants in parallel;
4. monitor tasks, tools, tokens, costs, errors and artifacts live;
5. compare reproducible and statistically validated backtests;
6. automatically iterate the variants within a limited budget;
7. retain every hypothesis, decision, file, run and result;
8. promote a candidate to paper trading;
9. subsequently connect a live broker with a bounded mandate and a kill switch;
10. Resume any work after closing the browser or restarting the VPS.

## 3. Product principles

- Real or clearly marked unavailable: no fictitious metrics in production mode.
- Bounded autonomy: the limits are code and data, not just the prompt.
- Persistence by default: no useful information depends solely on the browser.
- Traceability: every important action has a source and an inspectable result.
- Reproducibility: a backtest reference code, config, dataset, costs and versions.
- Paper-first: no automatic live promotion.
- Visual calm: lively and spatial interface, without masking the real state.
- Honest degradation: An offline service produces explicit status and diagnostic action.

## 4. Perimeter

### P0 — exploitable base

- Single-user authentication and revocable sessions.
- Vibe installed as a private localhost service.
- Real Vibe chat with sessions, SSE, tools and artifacts.
- Persistent registry of agents and teams based on Vibe presets.
- Launch, cancellation, retry and observation of swarms.
- Real file explorer, limited to authorized roots.
- Real runs, backtests, charts, metrics, validations and reports.
- Ledger, token usage and real costs.
- Persistent Human Inbox.
- Actual health of services.
- Automatic backup of canonical data.
- Safe removal of Hermes/Grafana and closure of unnecessary exposures.

### P1 — autonomous laboratory

- Experiment Studio for learning loops.
- Generations, variants, score function and champion/challenger.
- Register of hypotheses and memory linked to experiments.
- Sustainable planned workflows.
- Paper accounts and trade journal.
- Policies by agent: tools, markets, budgets, competition, permissions.
- Consolidated notifications and decisions without blocking independent tasks.

### P2 — bounded live trading

- Selected live broker connections.
- Expiring mandates configured from the interface.
- Orders within the limits of the mandate, according to policy by agent.
- Kill switch global and by broker always visible.
- Live audit and reconciliation of orders.
- Runner managed only for brokers whose guarantees are validated.

### Outside initial scope

- Multi-tenant, team roles or SaaS billing.
- Social network of strategies.
- HFT or low latency guarantees.
- Conservation of false screens that are purely decorative.
- Live trading before paper validation and explicit definition of markets/brokers.

## 5. Target navigation

| Area | Function |
|---|---|
| Observatory | real-time situation, alerts, active runs, budget, risk, next actions |
| AgentLab | agents, teams, roles, skills, models, tools, budgets and policies |
| Strategy Factory | hypotheses, strategy creation, templates and Vibe conversation |
| Experiments | loops, variants, generations, leaderboard and comparison |
| Runs | swarms, backtests, logs, artifacts, reproducibility and errors |
| Trading | connections, watchlists, paper portfolio, orders, journal, mandates and HALT |
| Files & Data | real files, datasets, snapshots, uploads and bounded editor |
| Knowledge | graph derived from agents, hypotheses, runs, files and memories |
| Automation | workflows and schedules actually executed |
| Inbox | confirmations, decisions, incidents and budget overruns |
| Activity & Usage | global audit, tokens, costs, time and resources |
| System | health, backups, connections, secrets and diagnostics |
| Codex Workshop | modification of the dashboard only, separate from trading operations |

## 6. Agent Lab

Each agent has at least:

- identity, role and versioned instructions;
- model/provider and parameters;
- authorized skills and tools;
- markets and data sources;
- budget tokens, cost, duration, iterations and retries;
- competition limit;
- filesystem/network/trading policy;
- confirmation policy;
- version history and execution metrics.

Teams are versioned DAGs. A modification creates a new version; old runs remain attached to their exact definition.

Acceptance criteria:

- create a team from one of the 29 presets;
- modify it without altering the historical runs;
- launch a team and see each worker in real time;
- stop/retry without losing the events already written;
- display actual consumption per worker.

## 7. Experiment Studio

### 7.1 Definition of an experiment

- hypothesis and objective;
- universe, period and frequency;
- data snapshot;
- basic strategy;
- mutable parameters and search space;
- maximum number of generations and variants;
- maximum competition;
- token budget, cost and duration;
- mandatory metrics;
- elimination constraints;
- score function;
- patience and stopping criteria;
- promotion rules.

### 7.2 Canonical cycle

```text
Hypothesis
  → variant generation
  → validation statique
  → bounded parallel backtests
  → anti-leakage and out-of-sample checks
  → risk/cost/execution review
  → classement
  → retained learnings
  → next generation or stop
  → champion/challenger
```

### 7.3 Non-negotiable rules

- Same data snapshot to compare a generation.
- Separation of train/validation/test and final period intact.
- Explicit costs, slippage and liquidity.
- Detection of missing or non-reproducible results.
- No selection based on gross yield alone.
- Any elimination and promotion is explained and persisted.
- Budget overrun: pause and Inbox, never silent pursuit.
- Champion means “best candidate in experience”, never “authorized live”.

### 7.4 P1 acceptance criteria

- launch at least three variants over two generations;
- close the browser then find the exact status;
- resume or conclude properly after restarting the engine;
- compare metrics, code, config and artifacts side by side;
- explain why each candidate progressed or was eliminated;
- stop automatically at the first criterion reached: budget, patience, time or score.

## 8. Autonomy and confirmations

Default risk levels:

| Level | Examples | Politics |
|---|---|---|
| A — autonomous | reading, searching, indexing, bounded calculation | immediate execution |
| B — budgeted autonomous | swarms, backtests, reporting | execution as long as budgets are not exceeded |
| C — exceptional confirmation | significant increase in budget, deletion, infrastructure change, new secret access | Human Inbox |
| D — real capital | mandate, live runner start, out-of-policy order or first activation | explicit consent and audit |
| E — prohibited | expand own mandate, disable audit, expose secrets | structural refusal |

A task blocked by a confirmation must not block other branches of the DAG.

## 9. Data and retention

Must be persisted:

- agents, teams, versions, prompts, skills and policies;
- sessions, messages, tool calls and attempts;
- workflows, jobs, events and decisions;
- strategies, hypotheses, experiments, candidates and scores;
- referenced datasets, snapshots and checksums;
- code, configs, logs, trades, charts, and reports;
- tokens, costs, CPU time and errors;
- connections, mandates, consents and live audit.

Initial policy: no automatic deletion. Archiving and purging will be explicit, previewed and logged. Secrets are excluded from ordinary exports.

## 10. Files & Data

- Explicit roots, for example Orbit workspace, Vibe runtime and artifacts.
- Prohibition of path traversal and symlink outside root.
- Reading, searching, creating, editing, moving, uploading and downloading.
- Diff before saving for sensitive files.
- Limited size and extensions; binary read/download only.
- Version or backup before overwriting.
- Direct link from a run to all its artifacts.

## 11. Trading

### Paper

- Broker sandbox or simulator connection clearly identified.
- Actual sandbox portfolio, positions, orders and history.
- Strategy and agent at the origin of each order.
- Reconciliation and performance log.

### Live

- Disabled globally upon installation.
- Multi-step activation with display of broker, account, duration and limits.
- Expiring mandate, cannot be modified by an agent.
- Permanent global HALT in navigation.
- Confirmations by order or autonomy in mandate are configurable by agent; the initial defect remains confirmation by order.
- No automatic promotion from an experience.

## 12. Non-functional requirements

- Private API linked to loopback; a single proxied public entry.
- Secrets encrypted at rest when possible and always excluded from UI responses.
- Versioned and restorable base migrations.
- Atomic writes, checksums for important artifacts.
- Jobs idempotent or explicitly non-repeatable for orders.
- SSE with reconnection, deduplication and event recovery.
- Separate health liveness/readiness.
- Interface usable on desktop and tablet; mobile for observation/HALT.
- Keyboard accessibility, motion reduction and contrast maintained.
- No fake “LIVE”, “ONLINE” or “successful” status.

## 13. Direction design

Maintain the existing spatial identity but add useful life:

- animated orbits and flows from real jobs;
- constellation of agents whose nodes change with their state;
- living timeline of tools;
- repositionable and persisted server-side widgets;
- state change transitions, no free animations;
- variable density between cockpit and detailed analysis;
- neat skeletons, empty states, errors and reconnections;
- fully functional motion reduction mode.

## 14. Measuring success

- zero business data only in `localStorage`;
- 100% of operational buttons connected or explicitly disabled;
- recovery after refresh for 100% of long jobs;
- each run has config, code, data, metrics and provenance;
- visible budget and consumption before, during and after an experience;
- no live order possible without a valid mandate;
- median time between an idea and three comparable backtests less than 10 minutes excluding provider/data time;
- no undocumented network exposure outside of SSH and public proxy.

## 15. Decisions still necessary before the trading phases

These decisions do not block the P0 base:

1. Vibe provider and operating models, with target monthly budget;
2. first market and first broker paper;
3. possible first live broker;
4. external backup policy and desired retention period.
