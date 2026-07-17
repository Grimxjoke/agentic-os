# Orbit OS — mapping of the existing

State observed on July 17, 2026, updated with the Phase 2 Vibe engine. This map describes what actually exists, what is simulated, and what can be reused. It does not constitute a functional promise.

## 1. Executive summary

Orbit now has a first persistent server core: revocable access sessions, PI/Codex conversations, jobs, events, decisions, auditing, migrations and SQLite backups. The System page and chat read this real data. The other business surfaces remain mainly powered by constants or `localStorage` and must still be replaced phase by phase.

Vibe-Trading is now installed as a pinned, isolated and persistent private engine. Orbit exposes an allowlisted BFF border for its health, its sessions, its SSE chat, its skills, its presets, its uploads and its runs. The `openai-codex` provider is authorized via the ChatGPT/Codex subscription, without an API key, and a first real search with streaming has been validated.

Hermes occupied several services, containers, tunnels and network routes. Declared obsolete and removeable by the owner, it was transactionally removed after the Orbit public path failover and restart test.

## 2. Deposits and responsibilities

| Location | State | Future role |
|---|---|---|
| `/home/codex/agentic-os` | public Git repository, Phase 1 on `main`, Phase 2 on dedicated branch | Orbit source of truth |
| `/opt/vibe-trading` | release upstream `86f6012e…` and virtualenv pinned | production Vibe engine, root-owned code |
| `/var/lib/vibe-trading` | `vibe-trading` private HOME and runtime | sessions, OAuth, memory, runs, uploads and durable artifacts |
| `/root/Vibe-Trading` | upstream audit filing, not executed | upstream inspection and comparison only |
| `/home/codex/Agentic OS` | depot almost empty | duplicate to be removed after verification |
| `/opt/agentic-os` | Caddy, MCP and non-Hermes infrastructure retained; Hermes/Grafana trees removed | preserve the infrastructure useful to Orbit |
| `/opt/hermes-*`, `/root/.hermes` | deleted after switch, restart and public validation | no future role |

## 3. Current orbit

### 3.1 Stack

- React 19, TypeScript 5.8, Vite 6, React Router 7.
- Modular native Node server under `server/`, with `server.mjs` as minimal entry point.
- Node 22 native SQLite in WAL/FULL, ordered SQL migrations and canonical data under `/var/lib/orbit-os`.
- The permanent token initializes an opaque session of 30 days; only its SHA-256 hash is retained and the session is revocable.
- Static build served under `/orbit/`.
- systemd service `orbit-os.service`, linked only to `127.0.0.1:4173` and hardened by systemd sandbox.
- Twenty-six Orbit tests also cover the Vibe border, its allowlist, limits, redaction and SSE relay. There is no automated end-to-end browser testing yet.

### 3.2 Real / local / simulated matrix

| Area | Actual Condition | Product destination |
|---|---|---|
| PI Cat | real call to PI CLI, persisted conversation/messages/job, read-only tools | replace later with an observable orchestration runtime |
| Codex Cat | isolated real call, persisted conversation and recovery of missing rollouts | keep only as dashboard modification workshop |
| Agents | CRUD `localStorage`, hardcoded templates and tools | Real Vibe Agent Registry, Profiles, Budgets and Policies |
| Skills | global page still local; real catalog of 87 skills visible in the Vibe cockpit | unify skills Vibe and Orbit with policies |
| Cron | local visual editor, deterministic PI proposal by keywords | persistent workflows actually executed and resumed after restart |
| Kanban | movable local maps | view derived from objectives, experiences, decisions and incidents |
| Files | allowlisted VPS explorer, atomic text editing and restorable backups | uploads and dataset snapshots |
| Knowledge | static graph | index of strategies, runs, hypotheses, agents, files and memories |
| Memory | four local entries | Durable Vibe memory with provenance, correction and search |
| Artifacts | static list | reports, code, metrics, logs and real exports |
| Vibe | real cockpit: health/provider, sessions, messages, SSE, 87 skills, 30 presets, uploads and runs | expand artifact details in Phase 3/4 |
| Trading | hardcoded data, external TradingView only | paper trading, accounts, positions, orders, risks and live bounded |
| Switchboard | editable local topology | real state of services and connections, without false switches |
| System | Orbit/SQLite/PI/Codex/Vibe health, real-world metrics and backup | extend with strictly allowlisted diagnostics and actions |
| Activity | ledger append-only present in base and summary in System; dedicated page still static | connect full page to ledger |
| Usage | costs and static tokens | real metrics by agent, model, run and experience |
| Settings | local appearance; simulated logins/permissions | persistent settings, server-side secrets, policies and budgets |
| Human Inbox | three requests in React memory | persistent queue of exceptional decisions and confirmations |
| Observatory | aggregation of all fictitious data | real-time cockpit from canonical sources |

### 3.3 Existing server gateway

The `server.mjs` entry point assembles the modules of `server/`, which provide:

- `GET /healthz` and `GET /readyz`, with alias under `/orbit/`;
- `GET /api/health` ;
- `POST /api/chat` for PI or Codex;
- limitation to one simultaneous request per agent;
- original control;
- bounded query and output size;
- process timeouts;
- common security headers and query error handling;
- transmission of prompts by stdin to avoid their presence in logged arguments;
- different systemd sandbox for Codex Plan and Build modes.
- SQLite, migrations, repositories and consistent backups;
- revocable sessions and conversion of the Phase 0 cookie;
- persistent conversations/messages without runtime identifier in the browser;
- jobs, events, decisions, audit and reconciliation of interrupted jobs;
- policies coded by risk level;
- System and Activity API redacted.

Limites :

- no SSE progressive diffusion or worker queue;
- interrupted jobs are reconciled to failure, but not yet resumed;
- no Files, Agents, Workflow, Usage or Audit API;
- the ledger exists, but its Activity page is not yet connected;
- Phase 0 conversations remaining only in `localStorage` are not automatically imported.

## 4. Current Vibe-Trading

### 4.1 Deployment Status

- Exact upstream revision `86f6012e00120e3fa5c3f0e15be8c94abe732dcf`, installed from the lockfile with hashes.
- System user `vibe-trading`, code root-owned, HOME/runtime private.
- Hardened systemd service, active and linked only to `127.0.0.1:8899`.
- Provider `openai-codex`, model `openai-codex/gpt-5.4`, without `OPENAI_API_KEY`.
- OAuth authorized: `/health` and `/ready` respond 200; the actual smoke test returned `VIBE_PHASE_2_OK` via Orbit and SSE.
- Shell and scheduler tools disabled; no broker or live trading configured.
- Persistence validated by creation, restart, rereading then deletion of a probe session.

### 4.2 Reusable capacities

- FastAPI API with remote authentication and SSE.
- Durable sessions and messages, writes `flush + fsync`.
- 87 finance skills actually returned by the deployed API.
- 30 multi-agent swarm presets actually returned by the deployed API.
- DAG: parallel tasks per layer, dependencies between layers, retries, timeout, cancellation, resumption and reconciliation of abandoned runs.
- Counting of tokens per worker and at the swarm level.
- Artifacts isolated per run and per agent.
- 452 Alpha Zoo factors and validation benches.
- Orbit now provides deterministic cost-aware backtests with checksummed snapshots, Monte Carlo, bootstrap and walk-forward validation; Vibe retains broader multi-market research capabilities.
- Durable register of hypotheses linked to runs.
- Shadow Account and analysis of trading logs.
- 10 families of connectors: Alpaca, Binance, Dhan, Futu, IBKR, Longbridge, OKX, Robinhood, Shoonya and Tiger.
- Read-only, paper and live profiles according to the guarantees available with each broker.

### 4.3 Persistance Vibe

The deployed runtime is distributed explicitly under `/var/lib/vibe-trading`:

- `.vibe-trading/sessions.db` and its WAL for sessions/messages;
- `memory/MEMORY.md` and Markdown entries;
- `hypotheses.json` ;
- `runtime/runs`, `runtime/sessions` and `runtime/uploads` connected to the engine's native paths;
- `runtime/swarm-runs` for multi-agent teams;
- `live/<broker>/mandate.json`, consents, daily counter and HALT;
- `live/audit.jsonl`, append-only journal of live actions.

Upstream relative paths are linked to the canonical runtime by the idempotent installer; a code update therefore does not replace any data.

### 4.4 Live Security already available

The live channel is structurally separated from ordinary tools:

- an agent proposition does not give any authority;
- only a privileged surface endpoint can write a mandate;
- immutable mandate, expiring and associated with user consent;
- ceilings: financing, order size, exposure, leverage, instruments and trades/day;
- authorized universe, liquidity/capitalization thresholds and excluded symbols;
- global kill switch or by broker, independent of the LLM;
- fail-closed checks before any order;
- audit redacted append-only ;
- cancellation authorized as a risk reduction action;
- optional flatten during a stop.

The persistent live runner is currently only exposed through the Robinhood MCP profile. Several other brokers accept limited live orders, but do not yet have the same managed runner.

### 4.5 Deviation from the desired learning loop

Vibe already knows: generate a strategy, launch a backtest, validate out of sample, compare results, memorize a hypothesis and run several analysts in parallel.

He does not yet know how to manage a sustainable experimental program from start to finish: successive generations, competing variants, fixed dataset, overall budget, score function, elimination, champion/challenger, automatic shutdown, recovery after crash and controlled promotion. This layer belongs to the future Orbit orchestrator, above the Vibe primitives.

## 5. Infrastructure VPS

### 5.1 Resources

- 2 vCPU, 7.8 GiB RAM, no swap.
- Approximately 50 GiB of free disk space.
- Node 22, Python 3.12, active Docker.

Competition must therefore be limited. Four LLM workers do not mean four simultaneous heavy CPU backtests.

### 5.2 Current public road

```text
Internet
  → reserved ngrok domain
  → ngrok-orbit.service
  → Caddy 127.0.0.1:18080
      ├─ / → redirection /orbit/
      ├─ /orbit/* → Orbit 127.0.0.1:4173
      ├─ /healthz and /readyz → Orbit
      └─ every other route → 404
```

The permanent domain is `https://trailside-capacity-worst.ngrok-free.dev`. Competing Cloudflare and ngrok Hermes tunnels are removed from the VPS. The Orbit tunnel is the only active application tunnel.

### 5.3 Obsolete services processed in Phase 0

- `hermes-gateway.service`, `hermes-operator-ui.service` and `hermes-operator-v4-preview.service` are stopped, disabled and removed from systemd;
- `ngrok-hermes-operator-dev.service`, `cloudflared-hermes-webui.service` and duplicate `cloudflared.service` are stopped, disabled and removed;
- Docker Hermes containers, images and networks are deleted;
- the Grafana, Cat and Hermes routes have been removed from Caddy;
- the system units, the root user unit and the PM2 Hermes supervisor are deleted;
- the old trees `/opt/hermes-*`, `/opt/agentic-os/hermes*`, `/root/.hermes`, the root and Grafana worktrees/sources are deleted;
- several gigabytes have been freed; no Hermes data was to be kept according to the owner.

### 5.4 Safety status after Phase 0

- Orbit and Caddy listen only on loopback; Hermes Control no longer publishes `10275`.
- The main ngrok tunnel is a single systemd unit, activated at boot, with root configuration in `0600` mode.
- Legacy units that contained tunnel references and their temporary rollback copies have been removed from the VPS.
- Remote revocation of old Cloudflare/ngrok tokens remains to be confirmed from supplier accounts; no token value is stored in Git.
- The host firewall remains inactive and the INPUT policy permissive. The TCP surface observed is nevertheless limited to SSH, Caddy/Orbit in loopback and the documented system services; activating a firewall should preserve SSH and Tailscale.

## 6. Architectural decisions retained

1. Orbit remains the only public surface and the only source of product truth.
2. Vibe remains a private localhost engine, versioned by SHA and called via an Orbit server gateway.
3. No Vibe/broker/provider secrets are sent to the browser.
4. SQLite stores the Orbit control-plane; large artifacts remain on disk with metadata and checksums in the database.
5. Vibe's native durable formats are retained; Orbit indexes them instead of blindly duplicating them.
6. Every action is a sustainable job with status, author, budget, timestamps, result and events.
7. Research, reading and paper trading are autonomous within defined budgets.
8. Unusual AI spending, risky infrastructure changes and live trading require an explicit policy and the Human Inbox.
9. Codex is not one of the trading agents: it remains reserved for the development of Orbit.
10. Hermes and Grafana were removed after proxy switch, restart test and Orbit rollback check.

## 7. Logical target

```text
Navigateur
  → tunnel permanent unique
  → Caddy (TLS/proxy)
  → Orbit API/BFF :4173 (loopback)
      ├─ auth + sessions
      ├─ agents + policies + budgets
      ├─ jobs + workflows + inbox
      ├─ files + artifacts + audit + usage
      ├─ experiment orchestrator
      └─ authenticated Vibe proxy
           → Vibe FastAPI :8899 (loopback)
               ├─ sessions / goals / memory
               ├─ swarms / skills / tools
               ├─ market data / backtests / alpha zoo
               └─ paper/live connectors + mandates + HALT

Stockage
  ├─ Orbit SQLite + migrations + sauvegardes
  ├─ volume artifacts/runs immutable
  ├─ volume runtime Vibe
  └─ ledger append-only + checksums
```
