# Phase 3 — Agent Lab and Runs

Status: implemented and validated on July 17, 2026.

## 1. Objective

Transform the decorative agents of the dashboard into persistent definitions,
versioned and executable. A team becomes an immutable DAG at the time of
launch ; each run retains its definition, its workers, its events, its
budgets, its errors and its artifacts.

## 2. Initial tranche — register of agents

The first workstream replaces `localStorage` and the Agent Lab fixtures with:

- a stable identity per agent;
- immutable and ordered versions;
- a model/provider, explicit instructions, tools and skills;
- token budgets, cost, duration and retries;
- filesystem, network and trading policies;
- a validated and audited Orbit API;
- an honest interface for creating and reviewing an agent.

Editing an agent never rewrites its previous version. Future runs
will reference the exact identifier of the version used.

## 3. Teams and DAG

A team has a stable identity and immutable versions. Each version
contains nodes that reference an agent version and edges of
dependence. The server refuses:

- cycles;
- unknown or archived references;
- nodes without a unique identifier;
- budgets above operator limits;
- competition incompatible with the configured capacity.

## 4. Runs

A launch materializes a team snapshot and creates a lasting run. The states
canonical are `queued`, `running`, `degraded`, `completed`, `failed` and
`cancelled`. Each worker has its own attempt and timeline.

The control plane must support launch, cancellation, limited retry, recovery after
refresh browser and reconciliation after restart. Tokens, costs, errors and
artifacts are measured data; an unavailable value remains `null`.

## 5. Real time and observability

- ordered and deduplicated events;
- SSE flow resumeable with the last known identifier;
- per-worker and global timelines;
- progression calculated from persisted states;
- Observatory powered by runs, without parallel fixture;
- audit of creations, revisions, launches, retries and cancellations.

## 6. Security

- no arbitrary shell commands from the editor;
- tools and skills stored as identifiers, never as executable code;
- trading disabled in the policies of this phase;
- budgets validated on the server side;
- secrets excluded from definitions and events;
- historical versions not modifiable, even by an ordinary SQL update.

## 7. Acceptance criteria

1. create an agent then a new version without altering the first;
2. find the register after restart;
3. create a valid team and refuse a cyclical DAG;
4. launch a team and follow each worker in real time;
5. cancel and retry without losing previous events;
6. refresh the browser during a run and find the exact state;
7. limit competition for VPS 2 vCPU;
8. present real tokens, cost, artifacts and errors;
9. feed Observatory from the same canonical data;
10. keep build, migrations and tests green.

## 8. Outside the perimeter

- generation and complete quantitative backtests (Phase 5);
- autonomous evolutionary loop (Phase 6);
- paper or live broker connection (Phases 7 and 8);
- file editing and unified memory (Phase 4).

## 9. Validation carried out

- versioned agents and teams with SQLite immutability;
- Cyclic DAGs and unknown references refused;
- real competition limited to two workers;
- private Vibe execution with tool policies, budgets and prohibited trading;
- cancel, retry and restart after restart tested;
- append-only events and SSE resumeable without duplication;
- unknown metrics kept at `null`;
- private Vibe paths removed from exposed artifacts;
- Agent Lab, Teams & Runs, Activity and Observatory connected to real APIs;
- TypeScript/Vite build and 37 unit/integration tests passed.
