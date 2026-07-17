import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { test } from "node:test";
import { backupDatabase, openDatabase, schemaVersion } from "../server/database.mjs";
import { hashToken, redact, safeJson } from "../server/security.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "orbit-db-test-"));
  const opened = await openDatabase({ dataDirectory: directory });
  return { directory, ...opened };
}

test("migrations are idempotent on an empty and an existing database", async () => {
  const first = await temporaryDatabase();
  try {
    assert.equal(schemaVersion(first.db), 4);
    const tables = first.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
    for (const name of ["access_sessions", "agent_versions", "agents", "artifact_index", "audit_entries", "conversations", "decisions", "events", "file_backups", "hypotheses", "jobs", "memories", "messages", "run_artifacts", "run_events", "run_workers", "runs", "schema_migrations", "team_versions", "teams"]) {
      assert.ok(tables.includes(name), `${name} should exist`);
    }
    first.db.close();
    const reopened = await openDatabase({ dataDirectory: first.directory });
    assert.equal(schemaVersion(reopened.db), 4);
    assert.equal(reopened.db.prepare("SELECT COUNT(*) count FROM schema_migrations").get().count, 4);
    reopened.db.close();
  } finally {
    await rm(first.directory, { recursive: true, force: true });
  }
});

test("agent definitions create immutable ordered versions", async () => {
  const opened = await temporaryDatabase();
  try {
    const store = new ControlPlaneStore(opened.db, () => "2026-07-17T12:00:00.000Z");
    const definition = {
      name: "Heron", role: "Quant researcher", description: "Tests hypotheses",
      instructions: "Be reproducible.", provider: "openai-codex", model: "gpt-5.4",
      tools: ["filesystem", "python"], skills: ["research"],
      budget: { maxTokens: 100000, maxCostUsd: 0, maxDurationMinutes: 30, maxRetries: 1 },
      policy: { filesystem: "read", network: "allow", trading: "deny" }, color: "amber",
    };
    const created = store.createAgent(definition);
    assert.equal(created.version, 1);
    const revised = store.createAgentVersion(created.id, { ...definition, instructions: "Be reproducible and cite data." });
    assert.equal(revised.version, 2);
    assert.equal(store.listAgents()[0].instructions, "Be reproducible and cite data.");
    assert.deepEqual(store.listAgentVersions(created.id).map((version) => version.version), [2, 1]);
    assert.equal(store.listAgentVersions(created.id)[1].instructions, "Be reproducible.");
    assert.throws(() => opened.db.prepare("UPDATE agent_versions SET name = 'Mutated' WHERE id = ?").run(created.versionId), /immutable/);
    assert.ok(store.recentActivity().some((event) => event.type === "agent.versioned"));
  } finally {
    opened.db.close();
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("agent registry survives a database close and reopen", async () => {
  const opened = await temporaryDatabase();
  let agentId;
  try {
    const store = new ControlPlaneStore(opened.db);
    const created = store.createAgent({
      name: "Atlas", role: "Architect", description: "Builds execution plans", instructions: "Keep history immutable.",
      provider: "openai-codex", model: "gpt-5.4", tools: ["filesystem"], skills: [],
      budget: { maxTokens: 50000, maxCostUsd: 0, maxDurationMinutes: 20, maxRetries: 1 },
      policy: { filesystem: "read", network: "deny", trading: "deny" }, color: "violet",
    });
    agentId = created.id;
    opened.db.close();

    const reopened = await openDatabase({ dataDirectory: opened.directory });
    const persisted = new ControlPlaneStore(reopened.db).getAgent(agentId);
    assert.equal(persisted.name, "Atlas");
    assert.equal(persisted.version, 1);
    assert.deepEqual(persisted.policy, { filesystem: "read", network: "deny", trading: "deny" });
    reopened.db.close();
  } finally {
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("repository transactions roll back interrupted writes", async () => {
  const opened = await temporaryDatabase();
  try {
    const store = new ControlPlaneStore(opened.db);
    assert.throws(() => store.transaction(() => {
      opened.db.prepare("INSERT INTO app_settings(key, value_json, updated_at) VALUES (?, ?, ?)").run("test", "{}", new Date().toISOString());
      throw new Error("simulated crash");
    }), /simulated crash/);
    assert.equal(opened.db.prepare("SELECT COUNT(*) count FROM app_settings").get().count, 0);
  } finally {
    opened.db.close();
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("running jobs are reconciled after a simulated restart", async () => {
  const opened = await temporaryDatabase();
  try {
    const store = new ControlPlaneStore(opened.db);
    const job = store.createJob({ kind: "test.crash", title: "Crash boundary" });
    assert.equal(store.counts().runningJobs, 1);
    opened.db.close();

    const reopened = await openDatabase({ dataDirectory: opened.directory });
    const recovered = new ControlPlaneStore(reopened.db);
    assert.equal(recovered.reconcileStaleJobs(), 1);
    assert.equal(recovered.counts().runningJobs, 0);
    const row = reopened.db.prepare("SELECT status, error FROM jobs WHERE id = ?").get(job.id);
    assert.equal(row.status, "failed");
    assert.match(row.error, /restart/);
    assert.ok(recovered.recentActivity().some((event) => event.type === "job.reconciled"));
    reopened.db.close();
  } finally {
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("conversations survive a database close and reopen", async () => {
  const opened = await temporaryDatabase();
  let conversationId;
  try {
    const store = new ControlPlaneStore(opened.db);
    const conversation = store.createConversation({ agent: "codex", title: "Durable session" });
    conversationId = conversation.id;
    store.addMessage({ conversationId, role: "user", mode: "plan", content: "Persist me" });
    store.addMessage({ conversationId, role: "assistant", mode: "plan", content: "Persisted" });
    opened.db.close();

    const reopened = await openDatabase({ dataDirectory: opened.directory });
    const persisted = new ControlPlaneStore(reopened.db);
    assert.equal(persisted.getConversation(conversationId).title, "Durable session");
    assert.deepEqual(persisted.listMessages(conversationId).map((message) => message.content), ["Persist me", "Persisted"]);
    reopened.db.close();
  } finally {
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("session secrets are hashed and audit payloads are redacted", async () => {
  const opened = await temporaryDatabase();
  try {
    const token = "session-token-that-must-never-be-stored";
    const store = new ControlPlaneStore(opened.db);
    const session = store.createAccessSession({ tokenHash: hashToken(token), label: "test" });
    const row = opened.db.prepare("SELECT token_hash tokenHash FROM access_sessions WHERE id = ?").get(session.id);
    assert.notEqual(row.tokenHash, token);
    assert.equal(row.tokenHash, hashToken(token));
    assert.equal(store.findActiveAccessSession(hashToken(token)).id, session.id);
    assert.equal(store.revokeAccessSession(session.id), true);
    assert.equal(store.findActiveAccessSession(hashToken(token)), null);

    const payload = JSON.parse(safeJson({ api_key: "secret-value", nested: { authorization: "Bearer sk-project-secret" }, note: "safe" }));
    assert.deepEqual(payload, { api_key: "[REDACTED]", nested: { authorization: "[REDACTED]" }, note: "safe" });
    assert.equal(redact("Bearer sk-project-secret"), "[REDACTED]");
    assert.equal(redact("11111111-1111-4111-8111-111111111111"), "11111111-1111-4111-8111-111111111111");
  } finally {
    opened.db.close();
    await rm(opened.directory, { recursive: true, force: true });
  }
});

test("SQLite backups are readable snapshots", async () => {
  const opened = await temporaryDatabase();
  try {
    const store = new ControlPlaneStore(opened.db);
    store.createConversation({ agent: "pi", title: "Before backup" });
    const result = await backupDatabase(opened.db, opened.directory);
    assert.match(result.filename, /^orbit-.*\.sqlite$/);
    assert.ok(result.bytes > 0);
    const header = await readFile(join(opened.directory, "backups", result.filename));
    assert.equal(header.subarray(0, 16).toString("utf8"), "SQLite format 3\u0000");
  } finally {
    opened.db.close();
    await rm(opened.directory, { recursive: true, force: true });
  }
});
