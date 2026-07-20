# Temporary Public Access Runbook

## Outcome

Orbit is temporarily reachable at the permanent ngrok URL without a login, token,
or OAuth redirect. ngrok provides HTTPS transport only. Orbit remains bound to
`127.0.0.1`, and Caddy remains bound to its loopback listener.

This is an explicitly accepted test-phase tradeoff. Anyone who discovers the URL can
read the interface, call Orbit APIs, execute available agents, and use authorized file
operations. The normal policy gates still deny live trading, but public mode is not a
security boundary.

## Active controls

- `ORBIT_AUTH_MODE=none` in the Orbit systemd drop-in.
- Orbit listens only on `127.0.0.1:4173`.
- Caddy and Vibe remain loopback-only.
- ngrok claims the permanent domain and forwards HTTPS without an OAuth policy.
- Same-origin request checks and existing action policies remain active.

## Verification

```bash
sudo systemctl is-active orbit-os ngrok-orbit
curl --fail --silent http://127.0.0.1:4173/orbit/readyz
curl --head https://trailside-capacity-worst.ngrok-free.dev/orbit/
curl --head https://trailside-capacity-worst.ngrok-free.dev/orbit/observatory
```

Both public Orbit requests must return the application or its normal `/orbit/`
redirect without sending the browser to Google and without returning HTTP 401.

## Restore authentication

Set `ORBIT_AUTH_MODE=token` or install another reviewed authentication border, reload
systemd, and restart Orbit. The default token mode remains implemented and tested;
public mode does not delete the existing token or session records.
