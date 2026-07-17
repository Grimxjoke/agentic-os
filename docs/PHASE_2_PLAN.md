# Phase 2 — executable technical plan

## Slice A — repeatable runtime

1. Pin the upstream SHA and provide an idempotent installer.
2. Create the Python user, home directories and virtualenv.
3. Install dependencies from the lockfile with hash checking.
4. Link the Vibe native data directories to the persistent runtime.
5. Install and harden the systemd loopback-only unit.
6. Test version, network bind, rights and restart.

## Workstream B — secure BFF client

1. Add a Vibe Node client with timeout, maximum size and redaction.
2. Define an allowlist of REST contracts separate from a generic proxy.
3. Relay the SSE with backpressure and `Last-Event-ID`.
4. Add health/abilities, sessions/messages, skills/presets and resources.
5. Test upstream unavailable, timeout, JSON error, payload too large,
unknown route and credential leak.

## Unit C — real cockpit

1. Replace constants and cat `localStorage` with `VibePage`.
2. Build a persistent session/sidebar/chat workspace.
3. View live tools and attempt events.
4. Add creation, renaming, deletion and undo.
5. Connect available skills/presets, uploads and artifacts.
6. Take care of OAuth required, offline, reconnecting, empty and failed states.

## Workstream D — ChatGPT/Codex authorization

1. Configure `LANGCHAIN_PROVIDER=openai-codex` without API key.
2. Run OAuth login under service user.
3. Check the provider status without exposing the token.
4. Send minimal search, receive events and replay history.

## Workstream E — validation and production

1. Run Vibe tests targeted at auth/session/SSE/security.
2. Run Orbit build and suite at each slice.
3. Test persistence and flow during restart Vibe.
4. Deploy Orbit, then check internal and public probes.
5. Scan code, diff, logs and Git artifacts for secrets.
6. Document operations/rollback, commit, push, and PR.
