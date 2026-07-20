import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createOrbitApplication } from "../server/app.mjs";

test("direct Google login establishes a protected Orbit session", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "orbit-google-login-"));
  const googleOAuthClient = { async verifyIdToken({ idToken, audience }) {
    assert.equal(audience, "orbit-web.apps.googleusercontent.com");
    return { getPayload: () => ({
      sub: "google-user-1",
      email: idToken.startsWith("allowed") ? "coinccrypto@gmail.com" : "other@example.com",
      email_verified: true,
      name: "Orbit Owner",
    }) };
  } };
  const app = await createOrbitApplication({
    authMode: "google",
    googleClientId: "orbit-web.apps.googleusercontent.com",
    googleAllowedEmail: "coinccrypto@gmail.com",
    googleOAuthClient,
    dataDirectory,
    workspace: process.cwd(),
  });
  try {
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const { port } = app.server.address();
    const origin = `http://127.0.0.1:${port}`;

    const anonymous = await fetch(`${origin}/orbit/observatory`, { redirect: "manual" });
    assert.equal(anonymous.status, 302);
    assert.match(anonymous.headers.get("location"), /^\/orbit\/login\?next=/);

    const login = await fetch(`${origin}/orbit/login?next=/orbit/observatory`);
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
    assert.match(await login.text(), /orbit-web\.apps\.googleusercontent\.com/);

    const denied = await fetch(`${origin}/orbit/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ credential: `denied${"x".repeat(120)}` }),
    });
    assert.equal(denied.status, 403);

    const accepted = await fetch(`${origin}/orbit/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "X-Forwarded-Proto": "https" },
      body: JSON.stringify({ credential: `allowed${"x".repeat(120)}` }),
    });
    assert.equal(accepted.status, 200);
    const cookie = accepted.headers.getSetCookie().find((value) => value.startsWith("orbit_session="));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);

    const sessionCookie = cookie.split(";", 1)[0];
    const protectedApi = await fetch(`${origin}/orbit/api/session`, { headers: { Cookie: sessionCookie } });
    assert.equal(protectedApi.status, 200);
    assert.match((await protectedApi.json()).session.label, /^Google · coinccrypto@gmail\.com$/);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    await app.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
