# Phase 7 Operations Runbook

## Runtime contract

- Application version: `0.12.0`.
- SQLite schema: `7`.
- Workflow Studio: `/orbit/cron`.
- Human Inbox: `/orbit/inbox`.
- Derived Kanban: `/orbit/kanban`.
- The scheduler checks due work and expirations every 30 seconds.

## Pre-deployment

1. Stop Orbit and make an explicit raw copy of its SQLite database.
2. Deploy the Phase 7 build and start Orbit.
3. Confirm health, readiness, version `0.12.0`, and schema `7`.
4. Confirm `GET /orbit/api/workflows`, `/orbit/api/inbox`, and
   `/orbit/api/kanban` using an authenticated session.

## Recovery and safety

The service resumes queued or running workflow runs after a restart. A schedule
occurrence is deduplicated by its persisted UTC occurrence key. Expirations are
resolved once and continue only a declared rejection edge. Completed workflow
steps and resolved decisions are never replayed.

The workflow node schema cannot execute tools, create orders, access a broker,
or promote a strategy. Those capabilities remain outside Phase 7.

## Rollback

Stop Orbit, preserve the schema-7 database for investigation, restore the
matching pre-Phase-7 database and Phase 6 application revision, then verify
health and readiness. Do not run a Phase 6 binary against a database that needs
the Phase 7 workflow records preserved.
