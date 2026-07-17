# Phase 1 — persistent foundation and actual System

Status: implementation contract validated on July 16, 2026.

## 1. Objective

Replace the prototype without server memory with a persistent control plane,
observable and testable. This phase does not start Vibe, nor a broker, nor a
trading order. It makes the functions already actually exposed reliable:
single-user access, PI, Codex, conversations and dashboard status.

## 2. User results

At the end of the phase:

1. reconnecting or restarting the browser finds the conversations;
2. the permanent cookie no longer contains the main access secret;
3. each device has a revocable, expiring and audited session;
4. each PI/Codex request creates a job and persistent events;
5. the System page only displays states measured by the backend;
6. user can trigger a local SQLite backup;
7. No ordinary click produces the misleading “simulated” global toast;
8. a service not yet installed is indicated as unavailable or deferred.

## 3. Functional scope

### 3.1 Canonical persistence

SQLite en mode WAL conserve :

- migration versions;
- access sessions, in hash form only;
- PI/Codex conversations and messages;
- jobs, events and decisions;
- append-only audit entries;
- future server settings in JSON key/value form.

The production base and its backups live in `/var/lib/orbit-os`, excluding
Git and off static build. Tests use directories exclusively
temporaires.

### 3.2 Authentication

The permanent token is only used to initialize a device. Orbit then transmits
a 256-bit opaque random token, stores only the SHA-256 of it and places it in
a `HttpOnly`, `SameSite=Strict` cookie, limited to 30 days. A session can be
revoked. The old Phase 0 cookie is converted on the next GET load.

### 3.3 Conversations

- List and creation of conversations by runtime (`pi` or `codex`).
- Messages stored before and after the call to runtime.
- Runtime recovery identifier kept on the server side, never required in the
  navigateur.
- If a Codex rollout has disappeared, Orbit starts again on a new thread and updates
  the existing conversation.
- Errors are recorded in the job and audit without storing any secrets.

### 3.4 System

The first truly operational page sets out:

- availability of Orbit, SQLite, PI, Codex and Vibe;
- uptime and memory of the Orbit process;
- version of the diagram and size of the base;
- real numbers of sessions, conversations, jobs, events and decisions;
- recent events redacted;
- manual creation of a local backup.

Dangerous system actions, reboots and terminal stay out
perimeter: no decorative button claims to execute them.

## 4. Phase API

| Method | Road | Function |
|---|---|---|
| GET | `/api/session` | non-sensitive metadata of the current session |
| DELETE | `/api/session` | revoke current session |
| GET | `/api/conversations?agent=` | list conversations |
| POST | `/api/conversations` | create a conversation |
| GET | `/api/conversations/:id/messages` | charger ses messages |
| POST | `/api/chat` | run PI/Codex and persist cycle |
| GET | `/api/system/overview` | actual status and counters |
| POST | `/api/system/backups` | create a consistent backup |
| GET | `/api/activity` | recent events/audit redacted |

All entries require identical origin and payloads strictly
validated. API errors have stable code and a bounded user message.

## 5. Outside the perimeter

- Vibe deployment or integration (Phase 2, deferred depending on product decision).
- CRUD of agents, workflows and experiences.
- Access to files, terminal or systemd commands from the browser.
- Paper/live trading.
- Migration of all demo pages in one go.
- Final graphic redesign; Phase 1, however, brings the true states of
loading, unavailability, health and activity.

## 6. Security constraints

- No secrets, tokens, sensitive paths or environment variables in the API.
- Session hash compared to constant value by exact database search.
- Expired or revoked sessions denied.
- Atomic transactions for job/event transitions.
- Payload JSON and bounded strings before writing.
- Base and backups created with a restrictive umask.
- The service remains linked to `127.0.0.1` and retains its systemd sandbox.

## 7. Acceptance criteria

- Idempotent migrations on empty database and already migrated database.
- An interrupted transaction leaves neither partial job nor orphan event.
- The permanent access token and the session token are missing from the SQL lines,
API responses and audit events in plain text.
- A conversation survives test server restart.
- A revoked session can no longer call the API.
- Codex error `no rollout found` remains automatically recovered.
- The System page does not import any data from `mockData` or `localStorage`.
- Build TypeScript/Vite, green unit testing and integration.
- Production deployment, healthchecks and protected access validated.

## 8. Rollback

The application rollback consists of restoring the Phase 0 commit and the old unit
systemd. The Phase 1 base remains intact and unused. Before any future migration
destructive, an SQLite backup is mandatory; no destructive migration
is not introduced in this phase.
