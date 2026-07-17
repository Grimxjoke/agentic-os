# Phase 1 — executable technical plan

## Workstream A — modules and data

1. Extract configuration, HTTP, schemas, runtimes and application from
   `server.mjs`.
2. Add SQLite manager, orderly SQL migrations and
repositories with prepared queries.
3. Test migrations, transactions, repositories, and redaction.

## Workstream B — revocable access

1. Issue an opaque session after validating the permanent token.
2. Convert the Phase 0 cookie to the first authenticated GET.
3. Add inspection and session revocation.
4. Test expiration, revocation, secure cookie and absence of clear token.

## Workstream C — jobs and conversations

1. Persist conversation, messages and runtime ID.
2. Encapsulate each PI/Codex call into a sustainable job.
3. Emit start, success, recovery and error events.
4. Expose the necessary read routes to the frontend.
5. Keep the Codex fallback for missing rollouts.

## Workstream D — real system and design

1. Replace simulated Control Center with an actual reading System page.
2. Show services, storage, counters and activity with loading/error states.
3. Add manual backup with local and verifiable feedback.
4. Replace fixed global badges and remove simulated auto toast.
5. Keep the spatial movement, but connect it to the statuses actually received.

## Workstream E — production

1. Build and run the entire test suite.
2. Create `/var/lib/orbit-os` with owner and restrictive permissions.
3. Install the updated systemd unit then restart Orbit.
4. Check migrations, probes, auth, API, Codex and System page.
5. Scan the diff and Git for secrets, document and publish.
