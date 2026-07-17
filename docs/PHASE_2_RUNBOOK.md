# Phase 2 — exploitation Vibe

## Invariants

- Vibe only listens on `127.0.0.1:8899`.
- The browser always goes through `/orbit/api/vibe/*`.
- The executed code matches the SHA logged in `deploy/install-vibe.sh`.
- Shell tools remain disabled.
- The `openai-codex` provider uses OAuth ChatGPT/Codex, without an OpenAI API key.
- The durable state lives under `/var/lib/vibe-trading` and is not deleted when
an update or a rollback.
- The canonical dotenv `~/.vibe-trading/.env` actually reflects the provider
executed; service secrets remain under `/etc/vibe-trading`.

## Installation idempotente

```text
sudo /home/codex/agentic-os/deploy/install-vibe.sh
sudo systemctl restart orbit-os
```

##OAuth authorization

This command must be run in an interactive terminal once:

```text
sudo -u vibe-trading -H /opt/vibe-trading/venv/bin/vibe-trading provider login openai-codex
```

It displays the authorization path managed by `oauth-cli-kit`. No tokens
obtained should not be copied into Git, a ticket or a message.

## Verifications

```text
systemctl is-active vibe-trading orbit-os
ss -lntp
curl -fsS http://127.0.0.1:8899/health
curl -fsS http://127.0.0.1:8899/ready
sudo -u vibe-trading -H /opt/vibe-trading/venv/bin/vibe-trading provider status
```

After OAuth, `/ready` should respond 200. Before OAuth, the code 503 with a
Non-sensitive reason is expected and Orbit should show "OAuth Required".

## Update

First modify the SHA in the PRD and the installer after upstream audit. Relaunch
the installer creates a new release and a new virtualenv; the data does not
not move. Never follow a mobile branch directly into production.

## Rollback

1. stop and disable `vibe-trading.service`;
2. restore the old Orbit unit if the BFF boundary needs to be removed;
3. keep `/var/lib/vibe-trading` and `/etc/vibe-trading`;
4. Verify that port 8899 is closed and the rest of Orbit remains ready.

```text
sudo systemctl disable --now vibe-trading
sudo ss -lntp | grep ':8899' || true
```
