# Implementation plan — Orbit Trading Agent OS

Development follows demonstrable vertical sections. A phase is only completed if its tests, migrations, observability and rollback are in place.

## 0. Work rules

- Establish a Git baseline before any refactor.
- Real functionality completely replaces its simulation; not maintaining two truths.
- Small, intentional and reversible commits.
- No Hermes cleaning before the new public road is tested.
- No secrets in Git, logs or the browser.
- No live trading during P0/P1.
- Continuous testing at each phase, not at the end of the project.

## 1. Target technical architecture

### Orbit BFF

The Node server remains the public boundary:

- single-user session;
- API Orbit ;
- authenticated Vibe proxy, including SSE;
- SQLite storage of the control plane;
- bounded filesystem access;
- jobs, policies, Inbox, audit, and usage;
- no arbitrary shell commands from the UI.

### Vibe Engine

- own checkout under a path accessible to a dedicated service user;
- upstream version pinned by SHA in the deployment configuration;
- isolated Python environment;
- `HOME`/explicit runtime in `/var/lib/vibe-trading`;
- API on `127.0.0.1:8899` with internal key;
- shell tools disabled at startup;
- hardened systemd service and backed up volume.

### Storage

- SQLite WAL for agents, workflows, jobs, policies, Inbox, links and metadata.
- Native Vibe runtime for sessions, memory, hypotheses and live.
- Artifacts on disk, with checksum and index in base.
- Ledger append-only for sensitive events.
- Consistent database + file backup.

## 2. Phases

### Phase 0 — baseline and network security

Status as of July 16, 2026: base deployed and restart tests successful. The only remaining external action is confirmation of revocation of old tunnel tokens in the provider consoles.

Livrables :

- first commit of the current state;
- inventory of secrets without displaying them;
- rotation of tunnel tokens exposed in the units;
- Orbit linked to `127.0.0.1`;
- closure of the public Hermes Control port;
- permanent tunnel managed by a single systemd unit;
- internal and external health checks;
- rollback procedure.

Tests :

- build TypeScript/Vite ;
- test HTTP auth/cookie/origin ;
- scan of expected ports;
- restart of the VPS simulated by restart of the units;
- verification of public link and deep links.

Validation carried out:

- TypeScript/Vite build and six green integration tests;
- Orbit and Caddy limited to loopback; Hermes Control port closed;
- single ngrok application tunnel managed by systemd;
- permanent domain, auth, deep links, PI and Codex retested after simultaneous restart;
- old Hermes units/tunnels stopped, deactivated and removed;
- containers, images, networks, supervisors and Hermes/Grafana trees deleted after validation;
- Git history, tree and diff scanned with no secrets detected.

### Phase 1 — testable and persistent foundation

Status as of July 16, 2026: implementation, local suite and production validation completed on the Phase 1 branch.

Livrables :

- division of `server.mjs` into testable modules;
- schema validation of API inputs;
- SQLite, migrations, and repositories;
- revocable server sessions;
- Job/Event/Decision/Audit model;
- migration runner and local backup;
- removal of the “simulated” global toast.

Tests :

- unit repositories and policies;
- API integration on a temporary basis;
- forward migrations on an empty database and a snapshot;
- crash while writing;
- writing and absence of secrets in the answers.

Validation carried out:

- TypeScript/Vite build and eighteen green unit/integration tests;
- real SQLite migration and backup under `/var/lib/orbit-os`;
- public session initialized then revoked without exposing the permanent token;
- System page validated on the protected public API;
- real Codex Plan call, job and messages reread from SQLite;
- pinned service on Node 22 and green internal/public probes.

### Phase 2 — Real Vibe

Status as of July 17, 2026: engine, BFF, interface, OAuth ChatGPT/Codex, tests,
LLM smoke test and production deployment completed.

Livrables :

- systemd Vibe deployment;
- `/api/vibe/*` proxy and SSE streaming;
- health/provider configuration page without revealing the keys;
- real Vibe sessions and chat;
- actual list of 87 skills and 30 presets observed on the pinned review;
- uploads and artifacts;
- instrumentation of errors and timeouts.

Tests :

- Vibe backend suite targeted auth/session/SSE/security;
- contrats proxy Orbit↔Vibe ;
- SSE reconnection/deduplication;
- restart Vibe during a session;
- provider mock for cost-free testing.

Validation carried out:

- 26 Orbit tests and 92 Vibe tests targeted green;
- provider `openai-codex/gpt-5.4` ready without `OPENAI_API_KEY`;
- persistence confirmed after restarting Vibe;
- real response and complete SSE flow relayed via Orbit;
- three active services and green internal/public probes.

### Phase 3 — Agent Lab and Runs

Status as of July 17, 2026: implementation and validation completed. Agents and
teams are versioned, DAGs are validated, Vibe runs are persistent and
observables, and cancel/retry/resumption are covered. Observatory reads the same
canonical data. Build and 37 tests are green.

Livrables :

- versioned agent registry;
- team/DAG editor from presets;
- budgets and policies;
- launch, cancel, retry and swarm detail;
- real-time timeline per worker;
- real tokens, cost, artifacts and errors;
- observatory powered by real jobs.

Tests :

- immutable versioning;
- Invalid/cyclic DAG;
- bounded competition on 2 vCPUs;
- timeout, retry, cancellation, and stale runs;
- refresh browser during run;
- UI snapshots of pending/running/degraded/failed/completed states.

### Phase 4 — Files, Artifacts, Memory, Knowledge

Livrables :

- allowlisted filesystem browser;
- editing with diff and backup;
- unified index of Vibe artifacts;
- real memory with provenance;
- register of hypotheses;
- derived knowledge graph, not edited as a false topology.

Tests :

- `..` traversal, symlinks, extensions and sizes;
- atomic writing and backup restoration;
- index after addition/deletion;
- binary files;
- search and broken links.

### Phase 5 — Backtests and Strategy Factory

Livrables :

- creation of strategy from an objective;
- reproducible run with snapshot/config/code;
- RunDetail/Compare/Correlation/Alpha Zoo pages integrated into the Orbit design;
- validations Monte Carlo/bootstrap/walk-forward ;
- hypotheses linked to runs;
- log of data and overfit warnings.

Tests :

- deterministic synthetic dataset and code;
- future leak and lookahead;
- known metrics;
- missing/corrupted artifact;
- incompatible comparison;
- absence of network via fixtures for the CI.

### Phase 6 — Experiment Studio

Status as of July 20, 2026: implemented on `agent/phase-6-experiment-studio`; local build and deterministic suite pass. Human acceptance, deployment, and merge remain pending.

Livrables :

- Experiment/Generation/Candidate/Evaluation models;
- durable orchestrator on top of Vibe;
- backtest queue with CPU competition distinct from LLM competition;
- overall budgets and by generation;
- configurable score and elimination constraints;
- champion/challenger ;
- patience, stop and pause Inbox;
- recovery after crash;
- memory of lessons injected into the next generation.

Tests :

- deterministic loop with dummy provider and backtester;
- three variants, two generations;
- tokens/cost/time budget;
- incomplete candidates;
- ties and NaN score;
- crash/restart between each transition;
- idempotence of repeats;
- no implicit paper/live promotion.

### Phase 7 — Automations and Human Inbox

Delivered:

- a workflow builder mapped to a validated executable schema;
- a durable scheduler with IANA timezone and UTC occurrence keys;
- independent branches that are not blocked by a pending decision;
- durable notifications, approvals, rejections, and expirations;
- a Kanban derived from workflows, runs, and Inbox requests.

Tests:

- UTC timezone scheduling and next-occurrence calculation;
- recovery and schedule-occurrence deduplication;
- approval, rejection, and expiration paths;
- idempotent Inbox resolution without duplicate effects.

### Phase 8 — Paper Trading

Livrables :

- first paper connector chosen;
- account, positions, orders, quotes and history;
- paper order from a manually promoted strategy;
- journal, reconciliation and PnL;
- agent/strategy/run assignment.

Tests :

- sandbox only;
- host/key mismatch fail-closed ;
- order, cancellation, rejection and timeout;
- restart before accused broker;
- no route to a live host in the test papers.

### Phase 9 — Live limited, only after separate validation

Livrables :

- UI consent/mandate;
- policies confirmation by order or autonomy in mandate;
- Global HALT always accessible;
- audit and reconciliation;
- runner only for validated connector.

Tests obligatoires :

- absence/expiration/corruption of mandate;
- exceeding each ceiling;
- forbidden symbol/instrument/universe;
- kill switch before and during an activity;
- quote unavailable;
- double submission;
- redaction of all secrets;
- chaos simulation with dummy broker before any real key.

### Phase 10 — clean design and consolidation

The design is improved throughout the phases, then consolidated:

- server widgets and persistent layout;
- animations driven by real events;
- constellation of agents;
- responsive and motion reduction;
- empty/error/offline/reconnection states;
- final audit of visual consistency and accessibility.

## 3. Hermes cleaning

Imposed order:

1. create the new Caddyfile where Orbit becomes the root;
2. validate the configuration;
3. tilt the permanent tunnel;
4. check Orbit, auth, API, SSE and deep links;
5. stop/deactivate Hermes services and containers;
6. observe a window of stability;
7. remove explicitly listed units, containers, images and directories;
8. remove Grafana/cat routes;
9. rescan ports, processes, secrets and disk space;
10. document the no longer needed rollback and revoke the old tokens.

## 4. Pyramide de tests

- Unitary: business rules, policies, score, paths, redaction.
- Integration: API + SQLite + temporary filesystem + Vibe mock/real targeted.
- Contracts: Orbit/Vibe payloads and SSE events.
- End-to-end: browser against the production build, refresh/restart/offline.
- Security: auth, CSRF/origin, traversal, secret scan, ports and live gates.
- Resilience: crash, stale job, retry, idempotence and backup/restore.
- Visual: screenshots of critical pages and states.

Target quality orders:

```text
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
pytest -q <targeted Vibe suites>
```

## 5. Definition of Done of a slice

- real connected behavior;
- no demonstration data presented as real;
- diagram and migration included;
- designed errors and loading;
- audit and usage issued;
- green unit and integration tests;
- manual production test carried out;
- revised security and permissions;
- up-to-date documentation and rollback.

## 6. Recommended first installment

Start with Phase 0 then Phase 1, without integrating all of Vibe at once. The first visible result should be:

1. a unique and lasting public link;
2. a System page that displays real health;
3. a persistent and tested basis;
4. no more false global toast;
5. a base on which the Vibe chat and the swarms can be connected without redoing the architecture.
