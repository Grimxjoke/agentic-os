import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../server/database.mjs";
import { createRunOrchestrator, createVibeWorkerExecutor } from "../server/orchestrator.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

async function fixture({ retries = 1, nodes = 3 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "orbit-runs-test-"));
  const opened = await openDatabase({ dataDirectory: directory });
  const store = new ControlPlaneStore(opened.db);
  const definition = {
    role: "Researcher", description: "Tests deterministic workflows", instructions: "Return evidence.",
    provider: "mock", model: "mock-1", tools: [], skills: [],
    budget: { maxTokens: 10000, maxCostUsd: 1, maxDurationMinutes: 1, maxRetries: retries },
    policy: { filesystem: "deny", network: "deny", trading: "deny" }, color: "cyan",
  };
  const agents = [];
  for (let index = 0; index < nodes; index += 1) agents.push(store.createAgent({ ...definition, name: `Agent ${index + 1}` }));
  const teamNodes = agents.map((agent, index) => ({
    key: String.fromCharCode(97 + index), label: `Worker ${index + 1}`, agentVersionId: agent.versionId,
    task: `Task ${index + 1}`, dependsOn: index === nodes - 1 && nodes > 1 ? agents.slice(0, -1).map((_, parent) => String.fromCharCode(97 + parent)) : [],
  }));
  const team = store.createTeam({
    name: "Deterministic team", description: "Test DAG", maxConcurrency: 2, nodes: teamNodes,
    budget: { maxTokens: 100000, maxCostUsd: 10, maxDurationMinutes: 5 },
  });
  return { directory, ...opened, store, agents, team };
}

async function waitFor(store, runId, statuses, timeout = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const run = store.getRun(runId);
    if (statuses.includes(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Run ${runId} did not reach ${statuses.join(", ")}`);
}

test("orchestrator executes a dependency DAG with concurrency two and real metrics", async () => {
  const opened = await fixture();
  let active = 0;
  let peak = 0;
  const starts = [];
  const upstreamSeen = [];
  const executor = {
    async execute({ worker, upstreamOutputs, emit, artifact }) {
      active += 1;
      peak = Math.max(peak, active);
      starts.push(worker.nodeKey);
      upstreamSeen.push({ key: worker.nodeKey, dependencies: Object.keys(upstreamOutputs) });
      emit({ type: "tool_call", message: `mock ${worker.nodeKey}` });
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (worker.nodeKey === "c") artifact({ name: "report.md", kind: "markdown", uri: "vibe://report.md" });
      active -= 1;
      return { output: { content: `done ${worker.nodeKey}` }, tokensUsed: 10, costUsd: 0.01 };
    },
  };
  const orchestrator = createRunOrchestrator({ store: opened.store, executor, maxConcurrency: 2 });
  try {
    const run = opened.store.createRun({ teamId: opened.team.id, objective: "Execute the graph" });
    assert.equal(orchestrator.start(run.id), true);
    const finished = await waitFor(opened.store, run.id, ["completed"]);
    assert.equal(peak, 2);
    assert.ok(starts.indexOf("c") > starts.indexOf("a"));
    assert.ok(starts.indexOf("c") > starts.indexOf("b"));
    assert.deepEqual(upstreamSeen.find((item) => item.key === "c").dependencies.sort(), ["a", "b"]);
    assert.equal(finished.completedWorkers, 3);
    assert.equal(finished.tokensUsed, 30);
    assert.ok(Math.abs(finished.costUsd - 0.03) < 0.000001);
    const detail = opened.store.getRunDetail(run.id);
    assert.equal(detail.artifacts.length, 1);
    assert.ok(detail.events.some((event) => event.type === "worker.completed"));
    assert.throws(() => opened.db.prepare("UPDATE run_events SET message = 'mutated' WHERE run_id = ?").run(run.id), /append-only/);
  } finally {
    await orchestrator.shutdown();
    opened.db.close();
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("orchestrator retries a failed worker within its immutable agent budget", async () => {
  const opened = await fixture({ nodes: 1, retries: 1 });
  const executor = { async execute({ worker }) { if (worker.attempt === 1) throw new Error("transient"); return { output: { content: "recovered" }, tokensUsed: 4, costUsd: null }; } };
  const orchestrator = createRunOrchestrator({ store: opened.store, executor });
  try {
    const run = opened.store.createRun({ teamId: opened.team.id, objective: "Retry once" });
    orchestrator.start(run.id);
    await waitFor(opened.store, run.id, ["completed"]);
    const attempts = opened.store.listRunWorkers(run.id);
    assert.deepEqual(attempts.map((worker) => worker.status), ["failed", "completed"]);
    assert.deepEqual(attempts.map((worker) => worker.attempt), [1, 2]);
  } finally {
    await orchestrator.shutdown(); opened.db.close(); await rm(opened.directory, { recursive: true, force: true });
  }
});

test("cancellation preserves events and stops an active worker", async () => {
  const opened = await fixture({ nodes: 1, retries: 0 });
  const executor = { execute: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
  }) };
  const orchestrator = createRunOrchestrator({ store: opened.store, executor });
  try {
    const run = opened.store.createRun({ teamId: opened.team.id, objective: "Cancel safely" });
    orchestrator.start(run.id);
    await waitFor(opened.store, run.id, ["running"]);
    assert.equal(opened.store.requestRunCancel(run.id), true);
    orchestrator.cancel(run.id);
    await waitFor(opened.store, run.id, ["cancelled"]);
    const detail = opened.store.getRunDetail(run.id);
    assert.equal(detail.currentWorkers[0].status, "cancelled");
    assert.ok(detail.events.some((event) => event.type === "run.cancel_requested"));
    assert.ok(detail.events.some((event) => event.type === "run.cancelled"));
  } finally {
    await orchestrator.shutdown(); opened.db.close(); await rm(opened.directory, { recursive: true, force: true });
  }
});

test("stale running workers are reconciled into a durable retry", async () => {
  const opened = await fixture({ nodes: 1, retries: 1 });
  try {
    const run = opened.store.createRun({ teamId: opened.team.id, objective: "Survive restart" });
    opened.store.startRun(run.id);
    opened.store.startWorker(opened.store.latestRunWorkers(run.id)[0].id);
    assert.equal(opened.store.reconcileStaleRuns(), 1);
    assert.equal(opened.store.getRun(run.id).status, "degraded");
    assert.deepEqual(opened.store.listRunWorkers(run.id).map((worker) => worker.status), ["failed", "queued"]);
  } finally {
    opened.db.close(); await rm(opened.directory, { recursive: true, force: true });
  }
});

test("Vibe executor converts upstream SSE into measured worker output and artifacts", async () => {
  const frame = [
    "id: 1\nevent: attempt.started\ndata: {}\n\n",
    "id: 2\nevent: tool_call\ndata: {\"tool\":\"python\"}\n\n",
    "id: 3\nevent: llm_usage\ndata: {\"input_tokens\":7,\"output_tokens\":5,\"cost_usd\":0.004}\n\n",
    "id: 4\nevent: artifact.created\ndata: {\"name\":\"report.md\",\"file_path\":\"/var/lib/vibe-trading/report.md\",\"kind\":\"markdown\"}\n\n",
    "id: 5\nevent: text_delta\ndata: {\"delta\":\"Verified result\"}\n\n",
    "id: 6\nevent: attempt.completed\ndata: {\"status\":\"completed\"}\n\n",
  ].join("");
  let prompt = "";
  const vibe = { sessions: {
    create: async () => ({ session_id: "session_1" }),
    send: async (_id, body) => { prompt = body.content; return {}; },
    stream: async () => new Response(frame, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    messages: async () => [], cancel: async () => ({}),
  } };
  const executor = createVibeWorkerExecutor(vibe);
  const emitted = [];
  const artifacts = [];
  let sessionId = "";
  const result = await executor.execute({
    run: { objective: "Find evidence", snapshot: { team: { name: "Desk" } } },
    worker: { nodeKey: "research", attempt: 1 },
    node: { label: "Research", task: "Inspect evidence", agent: { role: "Researcher", instructions: "Cite sources.", tools: ["python"], policy: { filesystem: "deny", network: "deny", trading: "deny" } } },
    upstreamOutputs: {}, signal: new AbortController().signal,
    emit: (event) => emitted.push(event), setSession: (value) => { sessionId = value; }, artifact: (value) => artifacts.push(value),
  });
  assert.equal(sessionId, "session_1");
  assert.match(prompt, /Find evidence/);
  assert.equal(result.output.content, "Verified result");
  assert.equal(result.tokensUsed, 12);
  assert.equal(result.costUsd, 0.004);
  assert.equal(artifacts[0].uri, "vibe-artifact://report.md");
  assert.ok(emitted.some((event) => event.type === "vibe.tool_call"));
});
