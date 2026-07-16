import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const token = "orbit-phase-zero-test-token";
let child;
let fakeBin;
let origin;

async function freePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitUntilReady(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${url}/orbit/healthz`);
      if (response.ok) return;
    } catch {
      // The child may still be binding the socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Orbit test server did not become ready");
}

async function rawStatus(path) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = request({
      host: url.hostname,
      port: url.port,
      path,
      headers: { Cookie: `orbit_access=${token}` },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  fakeBin = await mkdtemp(join(tmpdir(), "orbit-test-bin-"));
  await writeFile(join(fakeBin, "sudo"), `#!/usr/bin/env node
const args = process.argv.slice(2);
process.stdin.resume();
process.stdin.on("end", () => {
  if (args.includes("resume")) {
    process.stderr.write("Error: thread/resume failed: no rollout found for thread id 00000000-0000-4000-8000-000000000000");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "11111111-1111-4111-8111-111111111111" }) + "\\n");
  process.stdout.write(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "CODEX_SESSION_RECOVERED" } }) + "\\n");
});
`, { mode: 0o755 });
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ORBIT_ACCESS_TOKEN: token,
      ORBIT_WORKSPACE: process.cwd(),
      PATH: `${fakeBin}:${process.env.PATH || ""}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitUntilReady(origin);
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await once(child, "exit");
  }
  if (fakeBin) await rm(fakeBin, { recursive: true, force: true });
});

test("liveness and readiness disclose no private configuration", async () => {
  const live = await fetch(`${origin}/orbit/healthz`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { ok: true, status: "alive" });

  const ready = await fetch(`${origin}/orbit/readyz`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { ok: true, status: "ready" });
});

test("protected pages reject anonymous requests with security headers", async () => {
  const response = await fetch(`${origin}/orbit/`, { redirect: "manual" });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(await response.text(), /Accès protégé/);
});

test("access links establish a secure cookie and remove the token from the URL", async () => {
  const response = await fetch(`${origin}/orbit/?access=${encodeURIComponent(token)}`, {
    headers: { "X-Forwarded-Proto": "https" },
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/orbit/");
  assert.doesNotMatch(response.headers.get("location"), /access=/);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
});

test("authenticated API and SPA deep links work", async () => {
  const headers = { Cookie: `orbit_access=${token}` };
  const health = await fetch(`${origin}/orbit/api/health`, { headers });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const page = await fetch(`${origin}/orbit/agents`, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);
});

test("cross-origin writes are rejected before agent execution", async () => {
  const response = await fetch(`${origin}/orbit/api/chat`, {
    method: "POST",
    headers: {
      Cookie: `orbit_access=${token}`,
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
    },
    body: JSON.stringify({ agent: "pi", mode: "plan", message: "ignored" }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Origine refusée" });
});

test("a missing Codex rollout starts a fresh session", async () => {
  const response = await fetch(`${origin}/orbit/api/chat`, {
    method: "POST",
    headers: {
      Cookie: `orbit_access=${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent: "codex",
      mode: "plan",
      message: "recover this stale session",
      sessionId: "00000000-0000-4000-8000-000000000000",
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.reply, "CODEX_SESSION_RECOVERED");
  assert.equal(body.sessionReset, true);
  assert.equal(body.sessionId, "11111111-1111-4111-8111-111111111111");
});

test("malformed encoded paths do not crash the server", async () => {
  let malformedResult;
  try {
    malformedResult = await rawStatus("/orbit/%E0%A4%A");
  } catch (error) {
    // Node's HTTP parser may close an invalid request before the handler runs.
    assert.equal(error.code, "ECONNRESET");
    malformedResult = "reset";
  }
  assert.ok(malformedResult === 400 || malformedResult === "reset");

  const live = await fetch(`${origin}/healthz`);
  assert.equal(live.status, 200);
});
