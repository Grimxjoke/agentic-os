# Phase 7 Plan — Automations and Human Inbox

Phase 7 makes automations durable and reviewable. It introduces an executable,
validated workflow graph, calendar schedules, a persistent Human Inbox, and a
read-only Kanban derived from database state. It authorizes no broker, market
data, paper-trading, or live-trading capability.

## Contract

- A workflow is a bounded directed graph with up to 64 nodes and 128 edges.
- The initial safe node set is `trigger`, `noop`, `notify`, and `approval`.
- Each scheduled occurrence has a unique durable key; retries cannot create a
  second workflow run for the same occurrence.
- Daily schedules use an IANA timezone and store all instants in UTC. The next
  valid local clock instant is recalculated after every execution.
- Approval nodes create durable Inbox requests. Their independent branches can
  complete while the approval is waiting. Approval, rejection, and expiration
  follow explicit graph edges.
- On restart, queued and running runs resume; completed steps and previously
  resolved requests are not repeated.
- Kanban is an API-derived view of workflows, workflow runs, and Inbox requests;
  it is not a second editable source of truth.

## Explicit non-goals

- No agent/tool execution beyond safe local workflow state and notifications.
- No paper order, broker connector, quote feed, secret, or live-trading route.
- No autonomous approval: all approval decisions remain human-controlled.
