import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { createVibeApiHandler, createVibeClient, VibeError } from "../server/vibe.mjs";

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function withHandler(client, callback) {
  const handler = createVibeApiHandler(client);
  const server = createServer((req, res) => handler(req, res, new URL(req.url, "http://127.0.0.1")));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("Vibe client refuses non-loopback upstreams", () => {
  assert.throws(
    () => createVibeClient({ baseUrl: "https://vibe.example.com" }),
    /loopback/,
  );
});

test("Vibe overview distinguishes engine health from OAuth readiness", async () => {
  const calls = [];
  const client = createVibeClient({
    apiKey: "internal-test-secret",
    fetchImpl: async (url, init) => {
      calls.push({ path: url.pathname, authorization: init.headers.get("authorization") });
      if (url.pathname === "/health") return jsonResponse({ status: "healthy" });
      if (url.pathname === "/ready") return jsonResponse({ detail: "provider OAuth login not found" }, 503);
      if (url.pathname === "/api") return jsonResponse({ version: "0.1.11" });
      if (url.pathname === "/settings/llm") return jsonResponse({
        provider: "openai-codex",
        model_name: "openai-codex/gpt-5.4",
        api_key_required: false,
        api_key_configured: false,
      });
      return jsonResponse({}, 404);
    },
  });

  const overview = await client.overview();
  assert.deepEqual(overview, {
    engine: "online",
    ready: false,
    reason: "provider OAuth login not found",
    version: "0.1.11",
    provider: {
      name: "openai-codex",
      model: "openai-codex/gpt-5.4",
      authType: "oauth",
      authorized: false,
    },
  });
  assert.ok(calls.length >= 4);
  assert.ok(calls.every((call) => call.authorization === "Bearer internal-test-secret"));
  assert.doesNotMatch(JSON.stringify(overview), /internal-test-secret/);
});

test("Vibe client validates identifiers before contacting upstream", async () => {
  let called = false;
  const client = createVibeClient({ fetchImpl: async () => { called = true; return jsonResponse({}); } });
  assert.throws(() => client.sessions.messages("../../etc/passwd"), (error) => {
    assert.ok(error instanceof VibeError);
    assert.equal(error.status, 400);
    return true;
  });
  assert.equal(called, false);
});

test("Vibe errors are normalized and secret-like values are redacted", async () => {
  const client = createVibeClient({
    fetchImpl: async () => jsonResponse({ detail: "provider failed with sk-test-abcdefghijklmnopqrstuvwxyz123456" }, 500),
  });
  await assert.rejects(client.skills(), (error) => {
    assert.ok(error instanceof VibeError);
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /sk-test/);
    return true;
  });
});

test("Vibe client enforces the JSON response limit", async () => {
  const client = createVibeClient({
    fetchImpl: async () => jsonResponse({}, 200, { "Content-Length": String(3 * 1024 * 1024) }),
  });
  await assert.rejects(client.skills(), (error) => error instanceof VibeError && error.code === "upstream_too_large");
});

test("Orbit exposes only the explicit Vibe route contract", async () => {
  let calls = 0;
  const client = {
    overview: async () => ({ engine: "online", ready: false }),
    skills: async () => { calls += 1; return [{ name: "backtest", description: "Run a backtest" }]; },
    presets: async () => [],
    runs: async () => [],
    sessions: {
      list: async () => [],
      create: async () => ({}),
      get: async () => ({}),
      update: async () => ({}),
      remove: async () => ({}),
      messages: async () => [],
      send: async () => ({}),
      cancel: async () => ({}),
      stream: async () => new Response(),
    },
  };
  await withHandler(client, async (origin) => {
    const allowed = await fetch(`${origin}/api/vibe/skills`);
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).skills[0].name, "backtest");

    const denied = await fetch(`${origin}/api/vibe/settings/llm`);
    assert.equal(denied.status, 404);
    assert.deepEqual(await denied.json(), { error: "Route Vibe inconnue", code: "not_found" });
    assert.equal(calls, 1);
  });
});

test("Orbit validates Vibe message bodies before upstream execution", async () => {
  let sent = false;
  const client = {
    sessions: {
      send: async () => { sent = true; return {}; },
    },
  };
  await withHandler(client, async (origin) => {
    const malformed = await fetch(`${origin}/api/vibe/sessions/session_1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, "invalid_body");
    assert.equal(sent, false);
  });
});

test("Orbit relays Vibe SSE frames without rewriting event identifiers", async () => {
  const frame = "id: event-42\nevent: attempt.completed\ndata: {\"status\":\"completed\"}\n\n";
  const client = {
    sessions: {
      stream: async (_id, lastEventId) => {
        assert.equal(lastEventId, "event-41");
        return new Response(frame, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      },
    },
  };
  await withHandler(client, async (origin) => {
    const response = await fetch(`${origin}/api/vibe/sessions/session_1/events`, { headers: { "Last-Event-ID": "event-41" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.equal(await response.text(), frame);
  });
});
