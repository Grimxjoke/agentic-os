import { randomUUID } from "node:crypto";
import { parseSafeJson, safeJson } from "./security.mjs";

const terminal = new Set(["completed", "failed", "cancelled"]);

function workflowRow(row) {
  if (!row) return null;
  const { definitionJson, scheduleJson, ...rest } = row;
  return { ...rest, definition: parseSafeJson(definitionJson, {}), schedule: scheduleJson ? parseSafeJson(scheduleJson) : null };
}

function iso(clock) { return new Date(clock()).toISOString(); }

export function nextScheduledAt(schedule, from = new Date()) {
  if (!schedule) return null;
  if (schedule.kind === "interval") return new Date(from.getTime() + schedule.everySeconds * 1_000).toISOString();
  if (schedule.kind !== "daily") return null;
  const [hour, minute] = schedule.at.split(":").map(Number);
  const zone = schedule.timezone || "UTC";
  // Find the next instant whose local clock matches. This works through DST changes
  // and deliberately chooses the first valid occurrence after `from`.
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const firstMinute = Math.floor(from.getTime() / 60_000) * 60_000 + 60_000;
  for (let timestamp = firstMinute; timestamp <= from.getTime() + 27 * 3_600_000; timestamp += 60_000) {
    const candidate = new Date(timestamp);
    const values = Object.fromEntries(formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    if (values.hour === hour && values.minute === minute) return candidate.toISOString();
  }
  throw new Error("Unable to calculate next scheduled run");
}

export function createAutomationService({ store }) {
  const db = store.db;
  const active = new Set();
  const select = `SELECT id, name, description, status, definition_json AS definitionJson, schedule_json AS scheduleJson,
    next_run_at AS nextRunAt, last_run_at AS lastRunAt, created_at AS createdAt, updated_at AS updatedAt FROM workflows`;
  const get = (id) => workflowRow(db.prepare(`${select} WHERE id = ?`).get(id));
  const list = () => db.prepare(`${select} ORDER BY created_at DESC`).all().map(workflowRow);

  function create(input, actor = "user") {
    const id = randomUUID(); const now = iso(store.clock);
    const nextRunAt = input.schedule ? nextScheduledAt(input.schedule, new Date(now)) : null;
    db.prepare(`INSERT INTO workflows(id, name, description, status, definition_json, schedule_json, next_run_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.name, input.description, input.enabled ? "active" : "draft", safeJson(input.definition), input.schedule ? safeJson(input.schedule) : null, nextRunAt, now, now);
    store.audit({ actor, action: "workflow.created", outcome: "success", targetType: "workflow", targetId: id });
    return get(id);
  }

  function update(id, input, actor = "user") {
    const current = get(id); if (!current) return null;
    const schedule = input.schedule === undefined ? current.schedule : input.schedule;
    const status = input.enabled === undefined ? current.status : input.enabled ? "active" : "paused";
    const now = iso(store.clock);
    const nextRunAt = status === "active" && schedule ? nextScheduledAt(schedule, new Date(now)) : null;
    db.prepare(`UPDATE workflows SET name = ?, description = ?, status = ?, definition_json = ?, schedule_json = ?, next_run_at = ?, updated_at = ? WHERE id = ?`)
      .run(input.name ?? current.name, input.description ?? current.description, status, safeJson(input.definition ?? current.definition), schedule ? safeJson(schedule) : null, nextRunAt, now, id);
    store.audit({ actor, action: "workflow.updated", outcome: "success", targetType: "workflow", targetId: id });
    return get(id);
  }

  function createRun(workflow, triggerKind, occurrenceKey, input = {}) {
    const existing = db.prepare(`SELECT id FROM workflow_runs WHERE workflow_id = ? AND occurrence_key = ?`).get(workflow.id, occurrenceKey);
    if (existing) return { id: existing.id, duplicate: true };
    const id = randomUUID(); const now = iso(store.clock);
    db.prepare(`INSERT INTO workflow_runs(id, workflow_id, status, trigger_kind, occurrence_key, input_json, created_at)
      VALUES (?, ?, 'queued', ?, ?, ?, ?)`)
      .run(id, workflow.id, triggerKind, occurrenceKey, safeJson(input), now);
    return { id, duplicate: false };
  }

  function nodes(definition) { return new Map(definition.nodes.map((node) => [node.id, node])); }
  function outgoing(definition, nodeId, outcome = "success") { return definition.edges.filter((edge) => edge.from === nodeId && (edge.when || "success") === outcome); }
  function queueStep(runId, nodeId, branchKey) {
    const existing = db.prepare("SELECT id FROM workflow_steps WHERE workflow_run_id = ? AND node_id = ? AND branch_key = ?").get(runId, nodeId, branchKey);
    if (existing) return;
    db.prepare(`INSERT INTO workflow_steps(id, workflow_run_id, node_id, branch_key, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)`)
      .run(randomUUID(), runId, nodeId, branchKey, iso(store.clock));
  }

  function runDetail(id) {
    const row = db.prepare(`SELECT id, workflow_id AS workflowId, status, trigger_kind AS triggerKind, occurrence_key AS occurrenceKey,
      attempt, input_json AS inputJson, output_json AS outputJson, error, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt FROM workflow_runs WHERE id = ?`).get(id);
    if (!row) return null;
    return { ...row, input: parseSafeJson(row.inputJson, {}), output: row.outputJson ? parseSafeJson(row.outputJson, {}) : null,
      steps: db.prepare(`SELECT id, node_id AS nodeId, branch_key AS branchKey, status, output_json AS outputJson, error, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt FROM workflow_steps WHERE workflow_run_id = ? ORDER BY created_at`).all(id).map(({ outputJson, ...step }) => ({ ...step, output: outputJson ? parseSafeJson(outputJson, {}) : null })) };
  }

  async function execute(runId) {
    if (active.has(runId)) return; active.add(runId);
    try {
      const run = runDetail(runId); const workflow = get(run?.workflowId);
      if (!run || !workflow || terminal.has(run.status)) return;
      const graph = nodes(workflow.definition);
      db.prepare("UPDATE workflow_runs SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?").run(iso(store.clock), runId);
      if (!db.prepare("SELECT 1 FROM workflow_steps WHERE workflow_run_id = ? LIMIT 1").get(runId)) queueStep(runId, workflow.definition.start, "root");
      while (true) {
        const step = db.prepare(`SELECT id, node_id AS nodeId, branch_key AS branchKey FROM workflow_steps WHERE workflow_run_id = ? AND status = 'queued' ORDER BY created_at LIMIT 1`).get(runId);
        if (!step) break;
        const node = graph.get(step.nodeId);
        if (!node) throw new Error(`Workflow node ${step.nodeId} is missing`);
        const now = iso(store.clock);
        db.prepare("UPDATE workflow_steps SET status = 'running', started_at = ? WHERE id = ?").run(now, step.id);
        if (node.kind === "approval") {
          const request = db.prepare("SELECT id, status FROM inbox_requests WHERE workflow_step_id = ?").get(step.id);
          if (!request) {
            const expiresAt = node.expiresInSeconds ? new Date(Date.parse(now) + node.expiresInSeconds * 1_000).toISOString() : null;
            db.prepare(`INSERT INTO inbox_requests(id, workflow_run_id, workflow_step_id, status, risk, title, detail, expires_at, created_at)
              VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`)
              .run(randomUUID(), runId, step.id, node.risk, node.title, node.detail, expiresAt, now);
          }
          db.prepare("UPDATE workflow_steps SET status = 'waiting' WHERE id = ?").run(step.id);
          continue;
        }
        if (node.kind === "notify") db.prepare("INSERT INTO notifications(id, workflow_run_id, kind, message, created_at, delivered_at) VALUES (?, ?, 'workflow', ?, ?, ?)")
          .run(randomUUID(), runId, node.message, now, now);
        db.prepare("UPDATE workflow_steps SET status = 'completed', output_json = ?, finished_at = ? WHERE id = ?").run(safeJson({ kind: node.kind }), now, step.id);
        for (const edge of outgoing(workflow.definition, node.id)) queueStep(runId, edge.to, `${step.branchKey}:${edge.to}`);
      }
      const waiting = Number(db.prepare("SELECT COUNT(*) AS count FROM workflow_steps WHERE workflow_run_id = ? AND status = 'waiting'").get(runId).count);
      const queued = Number(db.prepare("SELECT COUNT(*) AS count FROM workflow_steps WHERE workflow_run_id = ? AND status IN ('queued', 'running')").get(runId).count);
      if (queued) return;
      db.prepare("UPDATE workflow_runs SET status = ?, finished_at = CASE WHEN ? = 'completed' THEN ? ELSE NULL END WHERE id = ?")
        .run(waiting ? "waiting" : "completed", waiting ? "waiting" : "completed", iso(store.clock), runId);
    } catch (error) {
      db.prepare("UPDATE workflow_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run(String(error.message || error).slice(-1400), iso(store.clock), runId);
    } finally { active.delete(runId); }
  }

  function start(id, { triggerKind = "manual", occurrenceKey = randomUUID(), input = {} } = {}) {
    const workflow = get(id); if (!workflow || workflow.status === "archived") return null;
    const created = createRun(workflow, triggerKind, occurrenceKey, input);
    queueMicrotask(() => execute(created.id));
    return { ...created, run: runDetail(created.id) };
  }

  function resolveInbox(id, status, note = "", actor = "user") {
    if (!["approved", "rejected", "expired"].includes(status)) throw new Error("Invalid inbox resolution");
    const request = db.prepare("SELECT workflow_run_id AS workflowRunId, workflow_step_id AS workflowStepId, status FROM inbox_requests WHERE id = ?").get(id);
    if (!request) return null;
    if (request.status !== "pending") return { changed: false, request: inbox(id) };
    const now = iso(store.clock);
    db.prepare("UPDATE inbox_requests SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ? AND status = 'pending'").run(status, note.slice(0, 1400), now, id);
    const outcome = status === "approved" ? "success" : "rejected";
    db.prepare("UPDATE workflow_steps SET status = 'completed', output_json = ?, finished_at = ? WHERE id = ?").run(safeJson({ decision: status }), now, request.workflowStepId);
    const workflow = get(runDetail(request.workflowRunId).workflowId);
    const step = db.prepare("SELECT node_id AS nodeId, branch_key AS branchKey FROM workflow_steps WHERE id = ?").get(request.workflowStepId);
    for (const edge of outgoing(workflow.definition, step.nodeId, outcome)) queueStep(request.workflowRunId, edge.to, `${step.branchKey}:${edge.to}`);
    store.audit({ actor, action: `inbox.${status}`, outcome: "success", targetType: "inbox_request", targetId: id });
    queueMicrotask(() => execute(request.workflowRunId));
    return { changed: true, request: inbox(id) };
  }

  function inbox(id) {
    const one = `SELECT id, workflow_run_id AS workflowRunId, workflow_step_id AS workflowStepId, status, risk, title, detail, expires_at AS expiresAt, resolution_note AS resolutionNote, created_at AS createdAt, resolved_at AS resolvedAt FROM inbox_requests`;
    return id ? db.prepare(`${one} WHERE id = ?`).get(id) : db.prepare(`${one} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 250`).all();
  }
  function expire() {
    const rows = db.prepare("SELECT id FROM inbox_requests WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?").all(iso(store.clock));
    for (const { id } of rows) resolveInbox(id, "expired", "Expired automatically", "scheduler");
    return rows.length;
  }
  function tick() {
    expire(); const now = iso(store.clock);
    const due = db.prepare(`${select} WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?`).all(now).map(workflowRow);
    for (const workflow of due) {
      const occurrenceKey = `schedule:${workflow.nextRunAt}`;
      start(workflow.id, { triggerKind: "schedule", occurrenceKey });
      const next = nextScheduledAt(workflow.schedule, new Date(workflow.nextRunAt));
      db.prepare("UPDATE workflows SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?").run(now, next, now, workflow.id);
    }
    return due.length;
  }
  function recover() { expire(); for (const { id } of db.prepare("SELECT id FROM workflow_runs WHERE status IN ('queued', 'running')").all()) queueMicrotask(() => execute(id)); }
  function kanban() {
    const rows = db.prepare(`SELECT id, workflow_id AS workflowId, status, trigger_kind AS triggerKind, created_at AS createdAt FROM workflow_runs ORDER BY created_at DESC LIMIT 250`).all();
    return { backlog: list().filter((workflow) => workflow.status === "draft").map((workflow) => ({ id: workflow.id, type: "workflow", title: workflow.name, status: workflow.status })),
      active: rows.filter((row) => ["queued", "running", "waiting"].includes(row.status)).map((row) => ({ ...row, type: "workflow_run" })),
      completed: rows.filter((row) => row.status === "completed").map((row) => ({ ...row, type: "workflow_run" })),
      attention: inbox().filter((request) => request.status === "pending").map((request) => ({ ...request, type: "inbox_request" })) };
  }
  return { create, update, get, list, start, runDetail, inbox, resolveInbox, tick, recover, kanban };
}
