# Google Access Runbook

## Outcome

Orbit owns the Google login flow. ngrok only transports HTTPS traffic to the
loopback-bound service. Orbit validates the signed Google ID token for the configured
Web client ID, requires a verified email matching `coinccrypto@gmail.com`, and creates
a revocable `HttpOnly` Orbit session.

This replaces ngrok-managed OAuth after repeated `ERR_NGROK_3303` failures in ngrok's
hosted callback. It requires a Google Identity Services Web client ID but no client
secret.

## One-time Google configuration

Create an OAuth 2.0 client of type **Web application** in Google Cloud Console.
Configure:

- Authorized JavaScript origin:
  `https://trailside-capacity-worst.ngrok-free.dev`
- No client secret is copied into Orbit.

Install only the resulting client ID in the root-owned Orbit environment as
`ORBIT_GOOGLE_CLIENT_ID`. Set `ORBIT_GOOGLE_ALLOWED_EMAIL=coinccrypto@gmail.com` and
`ORBIT_AUTH_MODE=google`, then restart Orbit.

## Active controls

- Orbit stays bound to `127.0.0.1:4173`.
- ngrok forwards to the loopback Caddy listener without an OAuth traffic policy.
- The browser receives a Google credential only over HTTPS.
- `google-auth-library` verifies signature, issuer, expiry, and audience.
- Orbit separately verifies `email_verified` and the exact allowlisted email.
- The resulting Orbit session token is random, hashed at rest, revocable, `HttpOnly`,
  `SameSite=Strict`, and `Secure` through the public HTTPS endpoint.

## Verification

```bash
sudo systemctl is-active orbit-os ngrok-orbit
curl --fail --silent http://127.0.0.1:4173/orbit/healthz
curl --fail --silent http://127.0.0.1:4173/orbit/readyz
curl --head https://trailside-capacity-worst.ngrok-free.dev/orbit/
```

The public request redirects to `/orbit/login`, where the Google button is rendered.
After selecting `coinccrypto@gmail.com`, Orbit opens the originally requested page.
Another Google account must receive HTTP 403 from the login endpoint.

## Recovery

If Google Identity Services is unavailable, temporarily restore `ORBIT_AUTH_MODE=token`
and restart Orbit. Keep the ngrok tunnel transport-only. Never expose the Orbit or
Caddy listener on a non-loopback interface, and never place an access token or Google
credential in a URL, log, or repository file.
