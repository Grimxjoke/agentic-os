import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createOrbitApplication } from "../server/app.mjs";

async function waitForRun(origin, headers, runId, status = "completed") {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await fetch(`${origin}/orbit/api/runs/${runId}`, { headers });
    const body = await response.json();
    if (body.run?.status === status) return body.run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run ${runId} did not reach ${status}`);
}

test("protected team, run and resumable SSE contracts form a complete vertical slice", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "orbit-runs-api-"));
  const accessToken = "orbit-runs-integration-token";
  const executor = {
    async execute({ worker, emit, setSession, artifact }) {
      setSession(`session_${worker.nodeKey}_${worker.attempt}`);
      emit({ type: "tool_call", message: "deterministic tool", payload: { tool: "fixture" } });
      await new Promise((resolve) => setTimeout(resolve, 15));
      artifact({ name: `${worker.nodeKey}.md`, kind: "markdown", uri: `fixture://${worker.nodeKey}.md` });
      return { output: { content: `done ${worker.nodeKey}` }, tokensUsed: 12, costUsd: 0.02 };
    },
  };
  const app = await createOrbitApplication({
    dataDirectory,
    databasePath: join(dataDirectory, "orbit.sqlite"),
    accessToken,
    host: "127.0.0.1",
    port: 4173,
    runExecutor: executor,
    vibeClient: { overview: async () => ({ engine: "online", ready: true }) },
  });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const login = await fetch(`${origin}/orbit/?access=${encodeURIComponent(accessToken)}`, { redirect: "manual" });
    const cookie = login.headers.getSetCookie().find((value) => value.startsWith("orbit_session=")).split(";", 1)[0];
    const headers = { Cookie: cookie };
    const jsonHeaders = { ...headers, "Content-Type": "application/json" };
    const agentDefinition = {
      name: "Heron", role: "Researcher", description: "Deterministic", instructions: "Return evidence.",
      provider: "mock", model: "mock-1", tools: [], skills: [], color: "amber",
      budget: { maxTokens: 10000, maxCostUsd: 1, maxDurationMinutes: 1, maxRetries: 1 },
      policy: { filesystem: "deny", network: "deny", trading: "deny" },
    };
    const agentResponse = await fetch(`${origin}/orbit/api/agents`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(agentDefinition) });
    assert.equal(agentResponse.status, 201);
    const agent = (await agentResponse.json()).agent;

    const teamDefinition = {
      name: "Research desk", description: "API team", maxConcurrency: 2,
      nodes: [
        { key: "research", label: "Research", agentVersionId: agent.versionId, task: "Research", dependsOn: [] },
        { key: "review", label: "Review", agentVersionId: agent.versionId, task: "Review", dependsOn: ["research"] },
      ],
      budget: { maxTokens: 50000, maxCostUsd: 5, maxDurationMinutes: 5 },
    };
    const teamResponse = await fetch(`${origin}/orbit/api/teams`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(teamDefinition) });
    assert.equal(teamResponse.status, 201);
    const team = (await teamResponse.json()).team;
    assert.equal(team.version, 1);

    const cyclic = await fetch(`${origin}/orbit/api/teams`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ...teamDefinition, nodes: [
      { ...teamDefinition.nodes[0], dependsOn: ["review"] }, teamDefinition.nodes[1],
    ] }) });
    assert.equal(cyclic.status, 400);
    assert.equal((await cyclic.json()).code, "cyclic_team");

    const runResponse = await fetch(`${origin}/orbit/api/runs`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ teamId: team.id, objective: "Validate the API run" }) });
    assert.equal(runResponse.status, 202);
    const run = (await runResponse.json()).run;
    const streamResponse = await fetch(`${origin}/orbit/api/runs/${run.id}/events`, { headers });
    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get("content-type"), /text\/event-stream/);
    const streamText = await streamResponse.text();
    const events = streamText.split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
    assert.ok(events.some((event) => event.type === "run.completed"));
    assert.equal(new Set(events.map((event) => event.id)).size, events.length);

    const finished = await waitForRun(origin, headers, run.id);
    assert.equal(finished.currentWorkers.length, 2);
    assert.equal(finished.artifacts.length, 2);
    assert.equal(finished.tokensUsed, 24);
    assert.equal(finished.costUsd, 0.04);

    const replay = await fetch(`${origin}/orbit/api/runs/${run.id}/events`, { headers: { ...headers, "Last-Event-ID": String(events[0].id) } });
    const replayText = await replay.text();
    assert.doesNotMatch(replayText, new RegExp(`id: ${events[0].id}\\n`));

    const retriedResponse = await fetch(`${origin}/orbit/api/runs/${run.id}/retry`, { method: "POST", headers });
    assert.equal(retriedResponse.status, 202);
    const retried = (await retriedResponse.json()).run;
    assert.equal(retried.retryOfId, run.id);
    await waitForRun(origin, headers, retried.id);

    const observatoryResponse = await fetch(`${origin}/orbit/api/observatory`, { headers });
    assert.equal(observatoryResponse.status, 200);
    const observatory = (await observatoryResponse.json()).observatory;
    assert.equal(observatory.teams, 1);
    assert.equal(observatory.statuses.completed, 2);
    assert.equal(observatory.successRate, 100);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    await app.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
