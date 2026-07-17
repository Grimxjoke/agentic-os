# Phase 0 — deployment and rollback

## Invariants

- Orbit is the only publicly routed application.
- The Orbit process listens only on `127.0.0.1:4173`.
- Caddy listens only on `127.0.0.1:18080` and transmits `/orbit/*`, `/healthz` and `/readyz`.
- The permanent ngrok tunnel is managed by `ngrok-orbit.service`.
- Credentials remain exclusively outside Git in protected root files.
- User messages are passed to CLIs by stdin and are not included in arguments logged by sudo.
- Hermes/Grafana units, tunnels, supervisors, containers, images, networks and application trees are deleted after validation of the switchover.
- Public port `10275` is closed.

## Verification

```text
npm test
npm run check:health
node scripts/check-health.mjs https://trailside-capacity-worst.ngrok-free.dev
systemctl is-active orbit-os ngrok-orbit
ss -lntup
```

Expected network result:

- `127.0.0.1:4173` : Orbit ;
- `127.0.0.1:18080` : Caddy ;
- none `0.0.0.0:4173` ;
- no `10275` port.
- no `cloudflared` processes or ngrok tunnels other than `ngrok-orbit.service`.

## Rollback Caddy

Before the switch, the old file is copied out of the repository under
`/opt/agentic-os/docker/caddy/Caddyfile.pre-phase0`. To go back:

```text
sudo cp /opt/agentic-os/docker/caddy/Caddyfile.pre-phase0 /opt/agentic-os/docker/caddy/Caddyfile
sudo docker exec agentic-os-caddy caddy validate --config /etc/caddy/Caddyfile
sudo docker exec agentic-os-caddy caddy reload --config /etc/caddy/Caddyfile
```

The file is deliberately copied in place: replacing it atomically would break
the link with the file already mounted in the container. If this link has already been broken,
only recreate Caddy with `sudo docker compose up -d --force-recreate caddy`
from `/opt/agentic-os/docker/caddy`.

## Rollback Orbit

The deployed service is saved as `/etc/systemd/system/orbit-os.service.pre-phase0`.

```text
sudo install -m 0644 /etc/systemd/system/orbit-os.service.pre-phase0 /etc/systemd/system/orbit-os.service
sudo systemctl daemon-reload
sudo systemctl restart orbit-os
```

## Rollback tunnel

If `ngrok-orbit.service` does not recover the permanent domain:

```text
sudo systemctl disable --now ngrok-orbit
sudo /snap/bin/ngrok http 18080 --log=stdout --log-format=logfmt
```

The last resort is deliberately interactive so as not to create a second orphan tunnel in the background.

## Hermes

The Hermes/Grafana deletion is voluntary and explicitly authorized. She doesn't have
no application rollback: no Hermes history or data should be
preserved. The Phase 0 rollback only covers Orbit, Caddy and the public tunnel.
