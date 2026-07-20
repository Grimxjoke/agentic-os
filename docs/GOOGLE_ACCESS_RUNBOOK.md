# Google Access Runbook

## Outcome

The public Orbit endpoint is protected by ngrok's managed Google OAuth provider.
Only `coinccrypto@gmail.com` is allowed. Once Google accepts the session, Orbit does
not prompt for an Orbit access token.

This setup deliberately uses ngrok's managed OAuth application. No Google Cloud
project, OAuth client ID, or client secret is required for the single-user setup.

## Operator access

1. Open `https://trailside-capacity-worst.ngrok-free.dev/`.
2. Select `coinccrypto@gmail.com` in Google's account chooser.
3. Orbit opens at the original requested page.

ngrok controls the Google session. To deliberately start again, open:

```text
https://trailside-capacity-worst.ngrok-free.dev/ngrok/logout?auth_id=orbit-google
```

Then reopen Orbit and choose the permitted Google account.

## Active controls

- ngrok policy: `/root/snap/ngrok/common/orbit-google-oauth.yml` (`0600`, root-owned).
- ngrok systemd drop-in: `/etc/systemd/system/ngrok-orbit.service.d/google-oauth.conf`.
- Orbit systemd drop-in: `/etc/systemd/system/orbit-os.service.d/ngrok-google-auth.conf`.
- Orbit mode: `ORBIT_AUTH_MODE=ngrok_google`.
- Orbit and Caddy must remain loopback-only. Do not expose port `4173` or `18080` publicly.

The policy first authenticates through Google and then denies every email except
`coinccrypto@gmail.com`. Its Google session has a seven-day idle timeout and a
thirty-day maximum lifetime.

## Verification

```bash
sudo systemctl is-active orbit-os ngrok-orbit
curl --fail --silent http://127.0.0.1:4173/orbit/healthz
curl --fail --silent http://127.0.0.1:4173/orbit/readyz
curl --head https://trailside-capacity-worst.ngrok-free.dev/orbit/
```

The public request must return a `302` redirect to `idp.ngrok.com` before Google
authentication. After successful Google authentication, it must reach Orbit without
an Orbit token prompt.

## Recovery

If Google OAuth itself is unavailable, retain the source files and temporarily remove
the two Google-authentication systemd drop-ins, then reload systemd and restart both
services. This restores the former Orbit token login:

```bash
sudo rm /etc/systemd/system/ngrok-orbit.service.d/google-oauth.conf
sudo rm /etc/systemd/system/orbit-os.service.d/ngrok-google-auth.conf
sudo systemctl daemon-reload
sudo systemctl restart ngrok-orbit orbit-os
```

Only perform this rollback from an authenticated SSH session. Restore Google OAuth by
reinstalling the preserved drop-ins and restarting the services. Never change
`ORBIT_AUTH_MODE=ngrok_google` while Orbit listens on a non-loopback address.
