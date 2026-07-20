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
let dataDirectory;
let origin;
let authenticatedCookie;

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
  dataDirectory = await mkdtemp(join(tmpdir(), "orbit-test-data-"));
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
      ORBIT_DATA_DIR: dataDirectory,
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
  if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

async function authenticatedHeaders() {
  if (!authenticatedCookie) {
    const response = await fetch(`${origin}/orbit/?access=${encodeURIComponent(token)}`, {
      headers: { "X-Forwarded-Proto": "https" },
      redirect: "manual",
    });
    const setCookie = response.headers.getSetCookie().find((value) => value.startsWith("orbit_session="));
    assert.ok(setCookie);
    authenticatedCookie = setCookie.split(";", 1)[0];
  }
  return { Cookie: authenticatedCookie };
}

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
  assert.match(await response.text(), /Protected Access/);
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
  assert.match(cookie, /orbit_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, new RegExp(token));
});

test("authenticated API and SPA deep links work", async () => {
  const headers = await authenticatedHeaders();
  const health = await fetch(`${origin}/orbit/api/health`, { headers });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const page = await fetch(`${origin}/orbit/agents`, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);
});

test("cross-origin writes are rejected before agent execution", async () => {
  const headers = await authenticatedHeaders();
  const response = await fetch(`${origin}/orbit/api/chat`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
    },
    body: JSON.stringify({ agent: "pi", mode: "plan", message: "ignored" }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Origin refused", code: "origin_denied" });
});

test("a missing Codex rollout starts a fresh session", async () => {
  const headers = await authenticatedHeaders();
  const response = await fetch(`${origin}/orbit/api/chat`, {
    method: "POST",
    headers: {
      ...headers,
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
  assert.match(body.conversationId, /^[0-9a-f-]{36}$/);
  assert.equal(body.sessionId, undefined);

  const messages = await fetch(`${origin}/orbit/api/conversations/${body.conversationId}/messages`, { headers });
  assert.equal(messages.status, 200);
  const persisted = await messages.json();
  assert.deepEqual(persisted.messages.map((message) => message.role), ["user", "assistant"]);
  assert.equal(persisted.messages[1].content, "CODEX_SESSION_RECOVERED");
});

test("malformed encoded paths do not crash the server", async () => {
  const headers = await authenticatedHeaders();
  const cookie = headers.Cookie.split("=", 2)[1];
  let malformedResult;
  try {
    authenticatedCookie = `orbit_session=${cookie}`;
    malformedResult = await new Promise((resolve, reject) => {
      const url = new URL(origin);
      const req = request({ host: url.hostname, port: url.port, path: "/orbit/%E0%A4%A", headers: { Cookie: authenticatedCookie } }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      });
      req.on("error", reject);
      req.end();
    });
  } catch (error) {
    // Node's HTTP parser may close an invalid request before the handler runs.
    assert.equal(error.code, "ECONNRESET");
    malformedResult = "reset";
  }
  assert.ok(malformedResult === 400 || malformedResult === "reset");

  const live = await fetch(`${origin}/healthz`);
  assert.equal(live.status, 200);
});

test("system overview and backups expose measured, redacted data", async () => {
  const headers = await authenticatedHeaders();
  const overview = await fetch(`${origin}/orbit/api/system/overview`, { headers });
  assert.equal(overview.status, 200);
  const body = await overview.json();
  assert.equal(body.ok, true);
  assert.equal(body.database.schemaVersion, 6);
  assert.ok(body.services.some((service) => service.id === "orbit" && service.status === "operational"));
  assert.doesNotMatch(JSON.stringify(body), new RegExp(token));
  assert.doesNotMatch(JSON.stringify(body), /ORBIT_ACCESS_TOKEN|orbit-test-data/);

  const backup = await fetch(`${origin}/orbit/api/system/backups`, { method: "POST", headers });
  assert.equal(backup.status, 201);
  const backupBody = await backup.json();
  assert.match(backupBody.backup.filename, /^orbit-.*\.sqlite$/);
  assert.ok(backupBody.backup.bytes > 0);
});

test("Phase 4 APIs enforce file boundaries and persist sourced knowledge", async () => {
  const headers = await authenticatedHeaders();
  const traversal = await fetch(`${origin}/orbit/api/files?root=workspace&path=${encodeURIComponent("../etc")}`, { headers });
  assert.equal(traversal.status, 400);
  assert.equal((await traversal.json()).code, "file_boundary");

  const listing = await fetch(`${origin}/orbit/api/files?root=workspace&path=docs`, { headers });
  assert.equal(listing.status, 200);
  assert.ok((await listing.json()).entries.some((entry) => entry.name === "PRD.md" && entry.text));

  const hypothesisResponse = await fetch(`${origin}/orbit/api/hypotheses`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Integration hypothesis", statement: "A bounded test should persist.", rationale: "API contract", status: "testing", tags: ["contract"], sourceType: "file", sourceId: "workspace:docs/PRD.md" }),
  });
  assert.equal(hypothesisResponse.status, 201);
  const hypothesis = (await hypothesisResponse.json()).hypothesis;

  const memoryResponse = await fetch(`${origin}/orbit/api/memories`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Integration memory", content: "Retain the tested contract.", kind: "learning", confidence: 0.9, pinned: true, sourceType: "hypothesis", sourceId: hypothesis.id }),
  });
  assert.equal(memoryResponse.status, 201);
  const memory = (await memoryResponse.json()).memory;

  const graphResponse = await fetch(`${origin}/orbit/api/knowledge`, { headers });
  assert.equal(graphResponse.status, 200);
  const graph = (await graphResponse.json()).graph;
  assert.ok(graph.edges.some((edge) => edge.source === `memory:${memory.id}` && edge.target === `hypothesis:${hypothesis.id}`));
});

test("Phase 5 APIs generate reproducible strategies, validations, comparisons and correlations", async () => {
  const headers = await authenticatedHeaders();
  const createStrategy = async (objective) => {
    const response = await fetch(`${origin}/orbit/api/strategies/generate`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ objective }),
    });
    assert.equal(response.status, 201);
    return (await response.json()).strategy;
  };
  const firstStrategy = await createStrategy("Capture medium-term momentum using completed daily bars after explicit costs.");
  const secondStrategy = await createStrategy("Test mean reversion after extreme rolling z-score deviations using completed bars.");
  const datasetResponse = await fetch(`${origin}/orbit/api/datasets/synthetic`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ seed: 515, rows: 400, symbol: "FIXTURE" }),
  });
  assert.equal(datasetResponse.status, 201);
  const dataset = (await datasetResponse.json()).dataset;
  const execute = async (strategyVersionId) => {
    const response = await fetch(`${origin}/orbit/api/backtests`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ strategyVersionId, datasetSnapshotId: dataset.id, initialCapital: 100000, costBps: 2, slippageBps: 1, validationSamples: 100 }),
    });
    assert.equal(response.status, 201);
    return (await response.json()).backtest;
  };
  const first = await execute(firstStrategy.versionId);
  const second = await execute(secondStrategy.versionId);
  assert.equal(first.status, "completed");
  assert.equal(first.dataSnapshot.checksum, dataset.checksum);
  assert.equal(first.validations.length, 4);

  const detailResponse = await fetch(`${origin}/orbit/api/backtests/${first.id}`, { headers });
  assert.equal(detailResponse.status, 200);
  assert.equal((await detailResponse.json()).backtest.artifact.status, "available");

  const compareResponse = await fetch(`${origin}/orbit/api/backtests/compare`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ ids: [first.id, second.id] }),
  });
  assert.equal(compareResponse.status, 200);
  assert.equal((await compareResponse.json()).backtests.length, 2);

  const correlationResponse = await fetch(`${origin}/orbit/api/backtests/correlation`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ ids: [first.id, second.id] }),
  });
  assert.equal(correlationResponse.status, 200);
  assert.equal((await correlationResponse.json()).correlation.matrix.length, 2);

  const zoo = await fetch(`${origin}/orbit/api/alpha-zoo`, { headers });
  assert.equal(zoo.status, 200);
  assert.ok((await zoo.json()).factors.some((factor) => factor.status === "available"));
});

test("Phase 6 API runs a bounded research experiment without trading promotion", async () => {
  const headers = await authenticatedHeaders();
  const strategyResponse = await fetch(`${origin}/orbit/api/strategies/generate`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ objective: "Search for a robust momentum challenger using completed bars after costs." }),
  });
  assert.equal(strategyResponse.status, 201);
  const strategy = (await strategyResponse.json()).strategy;
  const datasetResponse = await fetch(`${origin}/orbit/api/datasets/synthetic`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ seed: 616, rows: 180, symbol: "P6FIXTURE" }),
  });
  assert.equal(datasetResponse.status, 201);
  const dataset = (await datasetResponse.json()).dataset;
  const createResponse = await fetch(`${origin}/orbit/api/experiments`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "API bounded experiment", objective: "Evaluate one research challenger and never promote it to paper or live trading.",
      baseStrategyVersionId: strategy.versionId, datasetSnapshotId: dataset.id,
      budget: { maxGenerations: 1, candidatesPerGeneration: 1, maxBacktests: 1 },
      score: { metric: "sharpe", minTrades: 0, maxDrawdown: 1, drawdownPenalty: 0.25 },
      backtestConfig: { validationSamples: 50 } }),
  });
  assert.equal(createResponse.status, 201);
  const experiment = (await createResponse.json()).experiment;
  const startResponse = await fetch(`${origin}/orbit/api/experiments/${experiment.id}/start`, { method: "POST", headers });
  assert.equal(startResponse.status, 202);
  let detail;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await fetch(`${origin}/orbit/api/experiments/${experiment.id}`, { headers });
    assert.equal(response.status, 200);
    detail = (await response.json()).experiment;
    if (["completed", "failed"].includes(detail.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(detail.status, "completed");
  assert.equal(detail.generations.length, 1);
  assert.equal(detail.candidates.length, 1);
  assert.equal(detail.backtestsUsed, 1);
  const completedEvent = detail.events.find((event) => event.type === "experiment.completed");
  assert.equal(completedEvent.payload.paperPromoted, false);
  assert.equal(completedEvent.payload.livePromoted, false);
});

test("agent registry creates and versions definitions through the protected API", async () => {
  const headers = await authenticatedHeaders();
  const definition = {
    name: "Atlas", role: "Strategy Architect", description: "Structure research.",
    instructions: "Build a repeatable plan.", provider: "openai-codex", model: "gpt-5.4",
    tools: ["filesystem", "web"], skills: [], color: "violet",
    budget: { maxTokens: 50000, maxCostUsd: 0, maxDurationMinutes: 20, maxRetries: 1 },
    policy: { filesystem: "read", network: "allow", trading: "deny" },
  };
  const createdResponse = await fetch(`${origin}/orbit/api/agents`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(definition),
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).agent;
  assert.equal(created.version, 1);
  assert.equal(created.policy.trading, "deny");

  const revisedResponse = await fetch(`${origin}/orbit/api/agents/${created.id}/versions`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...definition, instructions: "Build and then verify a reproducible plan." }),
  });
  assert.equal(revisedResponse.status, 201);
  assert.equal((await revisedResponse.json()).agent.version, 2);

  const historyResponse = await fetch(`${origin}/orbit/api/agents/${created.id}/versions`, { headers });
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.deepEqual(history.versions.map((version) => version.version), [2, 1]);
  assert.equal(history.versions[1].instructions, definition.instructions);

  const invalidResponse = await fetch(`${origin}/orbit/api/agents`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...definition, policy: { ...definition.policy, trading: "allow" } }),
  });
  assert.equal(invalidResponse.status, 400);
});

test("revoked browser sessions can no longer access the API", async () => {
  const headers = await authenticatedHeaders();
  const revoke = await fetch(`${origin}/orbit/api/session`, { method: "DELETE", headers });
  assert.equal(revoke.status, 200);
  assert.equal((await revoke.json()).ok, true);

  const denied = await fetch(`${origin}/orbit/api/health`, { headers, redirect: "manual" });
  assert.equal(denied.status, 401);
  authenticatedCookie = undefined;
});
