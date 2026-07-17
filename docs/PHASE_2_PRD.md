# Phase 2 — real Vibe engine

Status: implemented and validated on July 17, 2026.

## 1. Objective

Completely replace the simulated Vibe cockpit with a private, persistent and
observable. Orbit remains the only public border and the navigator does not receive
neither credential provider, nor service key, nor absolute path of the VPS.

This phase provides the Vibe conversational lab. It does not launch any
order, does not connect any live broker and does not yet build the editor
of versioned Phase 3 agents.

## 2. Provider decision

The user has a ChatGPT subscription including Codex. Vibe therefore uses the
provider `openai-codex` and its dedicated OAuth ChatGPT, without `OPENAI_API_KEY` and without
Separate OpenAI API billing. Initial authorization is a local operation
unique, stored in the private HOME of the Vibe service user.

Until this authorization is completed, the interface must distinguish:

- engine started;
- provider configured;
- authorized provider;
- session ready to run.

## 3. Deployment and isolation

- Pinned Vibe review: `86f6012e00120e3fa5c3f0e15be8c94abe732dcf`.
- This revision is after `v0.1.11` and contains fixes for
security, provider and sessions retained during the audit.
- Dedicated system user without interactive shell.
- Python code and environment under `/opt/vibe-trading`.
- Sustainable state under `/var/lib/vibe-trading`, private permissions.
- Sensitive configuration under `/etc/vibe-trading`, outside Git.
- Strict listening on `127.0.0.1:8899`.
- Shell tools explicitly disabled.
- Vibe is never routed directly by Caddy/ngrok.
- Systemd service hardened and restarted automatically.

## 4. Orbit Border ↔ Vibe

Orbit exposes an allow API listed under `/api/vibe`, authenticated by the session
Orbit and protected by the existing original control. The proxy:

- limits deadlines, request sizes and response sizes;
- adds the internal credential only on the server side;
- does not transmit any arbitrary browser headers;
- relays SSE events without buffering;
- keep `Last-Event-ID` for reconnection;
- transforms network errors into explicit and redacted states;
- prohibits unknown routes and settings/provider changes from
the browser during this phase.

Product routes: health/abilities, skills, presets, sessions, messages, cancellation,
events, uploads and artifacts/runs in reading.

## 5. User experience

The Vibe page only shows real data:

1. motor health and provider status;
2. creation, selection, renaming and deletion of sessions;
3. persistent message history;
4. sending a research objective;
5. real-time flow of attempts, tools, results and errors;
6. cancellation of an active attempt;
7. real catalog of skills and presets;
8. uploads and artifacts available when the engine exposes them;
9. empty, loading, reconnection, unavailable and unauthorized states.

There remains no text that purports to simulate a response, a run or a status.

## 6. Persistence and recovery

- Vibe sessions/messages remain the canonical source of the conversation.
- Data survives restart of Vibe, Orbit and VPS.
- An SSE flow can resume from its last known identifier without duplicating
events already displayed.
- A restart during an attempt ends in a recovered state or an error
honest ; never by a permanent spinner.
- No automatic purge is activated.

## 7. Security and safeguards

- No secrets in Git, JSON responses, logs or frontend.
- No direct browser access to `:8899`.
- No generic proxy to Vibe.
- Disabled shell tools even for loopback requests.
- Live trading and stock brokers outside the scope.
- Message size: 5,000 characters maximum, like the Vibe contract.
- Uploads limited to the Vibe contract and never served by arbitrary path.
- Errors are redacted before audit and response.

## 8. Acceptance criteria

The phase is accepted if:

1. Vibe is active after restart and only listens on loopback;
2. the revision actually executed matches the pinned SHA;
3. no `OPENAI_API_KEY` is needed;
4. health, skills and presets are read back via Orbit;
5. a session and its messages survive a restart;
6. SSE events pass through Orbit and reconnect without duplication;
7. the absence of OAuth produces a guided state, without crashes or false “ready”;
8. non-allowlisted Vibe routes are inaccessible;
9. Orbit tests and targeted Vibe tests are green;
10. The Orbit public link remains functional and no secrets are published.

## 9. Rollback

Rollback stops and disables `vibe-trading.service`, restores Orbit unit
previous if necessary and removes the `VIBE_*` variables from Orbit. The data
of `/var/lib/vibe-trading` are retained. No rollback should delete the
sessions, OAuth tokens or artifacts without explicit action.

## 10. Validation carried out

- OAuth ChatGPT/Codex allowed under service user, without API key.
- `/health` and `/ready` respond 200 with provider `openai-codex` ready.
- Real smoke test via Orbit: session, message, exact response
`VIBE_PHASE_2_OK`, SSE events and test session deletion.
- Persistence of a verified session after restart of the service.
- 26 Orbit tests and 92 targeted Vibe tests passed.
- Skills and presets actually observed: 87 and 30 on the pinned review.
