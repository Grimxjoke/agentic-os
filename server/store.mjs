import { randomUUID } from "node:crypto";
import { parseSafeJson, redact, safeJson } from "./security.mjs";

const now = () => new Date().toISOString();

function mapAgentRow(row) {
  if (!row) return null;
  const { toolsJson, skillsJson, budgetJson, policyJson, ...agent } = row;
  return {
    ...agent,
    tools: parseSafeJson(toolsJson),
    skills: parseSafeJson(skillsJson),
    budget: parseSafeJson(budgetJson),
    policy: parseSafeJson(policyJson),
  };
}

const agentSelect = `SELECT a.id, a.current_version_id AS versionId, v.version,
  v.name, v.role, v.description, v.instructions, v.provider, v.model,
  v.tools_json AS toolsJson, v.skills_json AS skillsJson,
  v.budget_json AS budgetJson, v.policy_json AS policyJson, v.color,
  v.created_by AS createdBy, a.created_at AS createdAt, a.updated_at AS updatedAt,
  v.created_at AS versionCreatedAt
  FROM agents a JOIN agent_versions v ON v.id = a.current_version_id`;

function mapTeamRow(row) {
  if (!row) return null;
  const { nodesJson, budgetJson, ...team } = row;
  return { ...team, nodes: parseSafeJson(nodesJson, []), budget: parseSafeJson(budgetJson) };
}

function mapRunRow(row) {
  if (!row) return null;
  const { snapshotJson, ...run } = row;
  return { ...run, snapshot: parseSafeJson(snapshotJson) };
}

function summarizeRun(run) {
  return {
    ...run,
    snapshot: {
      team: run.snapshot.team,
      nodes: (run.snapshot.nodes || []).map((node) => ({
        key: node.key,
        label: node.label,
        agentVersionId: node.agentVersionId,
        dependsOn: node.dependsOn,
        agent: node.agent ? { name: node.agent.name, color: node.agent.color, role: node.agent.role } : null,
      })),
    },
  };
}

function mapWorkerRow(row) {
  if (!row) return null;
  const { outputJson, ...worker } = row;
  return { ...worker, output: outputJson ? parseSafeJson(outputJson) : null };
}

const teamSelect = `SELECT t.id, t.current_version_id AS versionId, v.version, v.name,
  v.description, v.max_concurrency AS maxConcurrency, v.nodes_json AS nodesJson,
  v.budget_json AS budgetJson, v.created_by AS createdBy,
  t.created_at AS createdAt, t.updated_at AS updatedAt, v.created_at AS versionCreatedAt
  FROM teams t JOIN team_versions v ON v.id = t.current_version_id`;

const runSelect = `SELECT id, team_id AS teamId, team_version_id AS teamVersionId,
  retry_of_id AS retryOfId, status, objective, snapshot_json AS snapshotJson,
  max_concurrency AS maxConcurrency, total_workers AS totalWorkers,
  completed_workers AS completedWorkers, tokens_used AS tokensUsed, cost_usd AS costUsd,
  error, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt,
  cancel_requested_at AS cancelRequestedAt FROM runs`;

export class ControlPlaneStore {
  constructor(db, clock = now) {
    this.db = db;
    this.clock = clock;
  }

  transaction(work) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  createAccessSession({ tokenHash, label = "Orbit browser", ttlDays = 30 }) {
    const id = randomUUID();
    const createdAt = this.clock();
    const expiresAt = new Date(Date.parse(createdAt) + ttlDays * 86_400_000).toISOString();
    this.db.prepare(`INSERT INTO access_sessions
      (id, token_hash, label, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, tokenHash, label.slice(0, 120), createdAt, createdAt, expiresAt);
    this.audit({ actor: "user", action: "session.created", outcome: "success", targetType: "access_session", targetId: id });
    return this.getAccessSessionById(id);
  }

  getAccessSessionById(id) {
    return this.db.prepare(`SELECT id, label, created_at AS createdAt, last_seen_at AS lastSeenAt,
      expires_at AS expiresAt, revoked_at AS revokedAt FROM access_sessions WHERE id = ?`).get(id) || null;
  }

  findActiveAccessSession(tokenHash) {
    const session = this.db.prepare(`SELECT id, label, created_at AS createdAt, last_seen_at AS lastSeenAt,
      expires_at AS expiresAt, revoked_at AS revokedAt FROM access_sessions
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`).get(tokenHash, this.clock());
    return session || null;
  }

  touchAccessSession(id) {
    this.db.prepare("UPDATE access_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL").run(this.clock(), id);
  }

  revokeAccessSession(id) {
    const revokedAt = this.clock();
    const result = this.transaction(() => {
      const changed = this.db.prepare("UPDATE access_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(revokedAt, id).changes;
      if (changed) this.audit({ actor: "user", action: "session.revoked", outcome: "success", targetType: "access_session", targetId: id });
      return changed > 0;
    });
    return result;
  }

  createConversation({ agent, title }) {
    const id = randomUUID();
    const createdAt = this.clock();
    this.db.prepare(`INSERT INTO conversations(id, agent, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(id, agent, title.slice(0, 120), createdAt, createdAt);
    this.audit({ actor: "user", action: "conversation.created", outcome: "success", targetType: "conversation", targetId: id, metadata: { agent } });
    return this.getConversation(id);
  }

  getConversation(id) {
    return this.db.prepare(`SELECT id, agent, title, runtime_session_id AS runtimeSessionId,
      created_at AS createdAt, updated_at AS updatedAt FROM conversations
      WHERE id = ? AND archived_at IS NULL`).get(id) || null;
  }

  listConversations(agent) {
    return this.db.prepare(`SELECT c.id, c.agent, c.title, c.created_at AS createdAt, c.updated_at AS updatedAt,
      COUNT(m.id) AS messageCount FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.agent = ? AND c.archived_at IS NULL GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100`).all(agent);
  }

  addMessage({ conversationId, role, mode, content }) {
    const id = randomUUID();
    const createdAt = this.clock();
    this.db.prepare(`INSERT INTO messages(id, conversation_id, role, mode, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, conversationId, role, mode, content, createdAt);
    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(createdAt, conversationId);
    return { id, conversationId, role, mode, content, createdAt };
  }

  listMessages(conversationId) {
    return this.db.prepare(`SELECT id, conversation_id AS conversationId, role, mode, content,
      created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at, id`).all(conversationId);
  }

  setRuntimeSession(conversationId, runtimeSessionId) {
    this.db.prepare("UPDATE conversations SET runtime_session_id = ?, updated_at = ? WHERE id = ?")
      .run(runtimeSessionId || null, this.clock(), conversationId);
  }

  createAgent(definition, actor = "user") {
    const agentId = randomUUID();
    const versionId = randomUUID();
    const createdAt = this.clock();
    return this.transaction(() => {
      this.db.prepare(`INSERT INTO agents(id, created_at, updated_at)
        VALUES (?, ?, ?)`).run(agentId, createdAt, createdAt);
      this.db.prepare(`INSERT INTO agent_versions
        (id, agent_id, version, name, role, description, instructions, provider, model,
         tools_json, skills_json, budget_json, policy_json, color, created_by, created_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(versionId, agentId, definition.name, definition.role, definition.description,
          definition.instructions, definition.provider, definition.model,
          safeJson(definition.tools), safeJson(definition.skills), safeJson(definition.budget),
          safeJson(definition.policy), definition.color, actor, createdAt);
      this.db.prepare("UPDATE agents SET current_version_id = ? WHERE id = ?").run(versionId, agentId);
      this.event({ type: "agent.created", message: `${definition.name} créé`, payload: { agentId, version: 1 } });
      this.audit({ actor, action: "agent.created", outcome: "success", targetType: "agent", targetId: agentId, metadata: { versionId, version: 1 } });
      return this.getAgent(agentId);
    });
  }

  createAgentVersion(agentId, definition, actor = "user") {
    const versionId = randomUUID();
    const createdAt = this.clock();
    return this.transaction(() => {
      const agent = this.db.prepare("SELECT id FROM agents WHERE id = ? AND archived_at IS NULL").get(agentId);
      if (!agent) return null;
      const version = Number(this.db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM agent_versions WHERE agent_id = ?").get(agentId).version);
      this.db.prepare(`INSERT INTO agent_versions
        (id, agent_id, version, name, role, description, instructions, provider, model,
         tools_json, skills_json, budget_json, policy_json, color, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(versionId, agentId, version, definition.name, definition.role, definition.description,
          definition.instructions, definition.provider, definition.model,
          safeJson(definition.tools), safeJson(definition.skills), safeJson(definition.budget),
          safeJson(definition.policy), definition.color, actor, createdAt);
      this.db.prepare("UPDATE agents SET current_version_id = ?, updated_at = ? WHERE id = ?")
        .run(versionId, createdAt, agentId);
      this.event({ type: "agent.versioned", message: `${definition.name} révisé en v${version}`, payload: { agentId, versionId, version } });
      this.audit({ actor, action: "agent.versioned", outcome: "success", targetType: "agent", targetId: agentId, metadata: { versionId, version } });
      return this.getAgent(agentId);
    });
  }

  getAgent(id) {
    return mapAgentRow(this.db.prepare(`${agentSelect} WHERE a.id = ? AND a.archived_at IS NULL`).get(id));
  }

  listAgents() {
    return this.db.prepare(`${agentSelect} WHERE a.archived_at IS NULL ORDER BY a.updated_at DESC, a.id`).all().map(mapAgentRow);
  }

  listAgentVersions(agentId) {
    return this.db.prepare(`SELECT id AS versionId, agent_id AS id, version, name, role, description,
      instructions, provider, model, tools_json AS toolsJson, skills_json AS skillsJson,
      budget_json AS budgetJson, policy_json AS policyJson, color, created_by AS createdBy,
      created_at AS versionCreatedAt FROM agent_versions WHERE agent_id = ? ORDER BY version DESC`)
      .all(agentId).map(mapAgentRow);
  }

  getAgentVersion(versionId) {
    return mapAgentRow(this.db.prepare(`SELECT a.id, v.id AS versionId, v.version, v.name, v.role,
      v.description, v.instructions, v.provider, v.model, v.tools_json AS toolsJson,
      v.skills_json AS skillsJson, v.budget_json AS budgetJson, v.policy_json AS policyJson,
      v.color, v.created_by AS createdBy, a.created_at AS createdAt,
      a.updated_at AS updatedAt, v.created_at AS versionCreatedAt
      FROM agent_versions v JOIN agents a ON a.id = v.agent_id
      WHERE v.id = ? AND a.archived_at IS NULL`).get(versionId));
  }

  assertTeamAgentVersions(definition) {
    for (const node of definition.nodes) {
      if (!this.getAgentVersion(node.agentVersionId)) {
        const error = new Error(`Version agent inconnue pour ${node.key}`);
        error.code = "unknown_agent_version";
        throw error;
      }
    }
  }

  createTeam(definition, actor = "user") {
    this.assertTeamAgentVersions(definition);
    const teamId = randomUUID();
    const versionId = randomUUID();
    const createdAt = this.clock();
    return this.transaction(() => {
      this.db.prepare("INSERT INTO teams(id, created_at, updated_at) VALUES (?, ?, ?)").run(teamId, createdAt, createdAt);
      this.db.prepare(`INSERT INTO team_versions
        (id, team_id, version, name, description, max_concurrency, nodes_json, budget_json, created_by, created_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`)
        .run(versionId, teamId, definition.name, definition.description, definition.maxConcurrency,
          safeJson(definition.nodes), safeJson(definition.budget), actor, createdAt);
      this.db.prepare("UPDATE teams SET current_version_id = ? WHERE id = ?").run(versionId, teamId);
      this.event({ type: "team.created", message: `${definition.name} créée`, payload: { teamId, versionId, version: 1 } });
      this.audit({ actor, action: "team.created", outcome: "success", targetType: "team", targetId: teamId, metadata: { versionId, version: 1 } });
      return this.getTeam(teamId);
    });
  }

  createTeamVersion(teamId, definition, actor = "user") {
    this.assertTeamAgentVersions(definition);
    const versionId = randomUUID();
    const createdAt = this.clock();
    return this.transaction(() => {
      const team = this.db.prepare("SELECT id FROM teams WHERE id = ? AND archived_at IS NULL").get(teamId);
      if (!team) return null;
      const version = Number(this.db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM team_versions WHERE team_id = ?").get(teamId).version);
      this.db.prepare(`INSERT INTO team_versions
        (id, team_id, version, name, description, max_concurrency, nodes_json, budget_json, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(versionId, teamId, version, definition.name, definition.description, definition.maxConcurrency,
          safeJson(definition.nodes), safeJson(definition.budget), actor, createdAt);
      this.db.prepare("UPDATE teams SET current_version_id = ?, updated_at = ? WHERE id = ?").run(versionId, createdAt, teamId);
      this.event({ type: "team.versioned", message: `${definition.name} révisée en v${version}`, payload: { teamId, versionId, version } });
      this.audit({ actor, action: "team.versioned", outcome: "success", targetType: "team", targetId: teamId, metadata: { versionId, version } });
      return this.getTeam(teamId);
    });
  }

  getTeam(id) {
    return mapTeamRow(this.db.prepare(`${teamSelect} WHERE t.id = ? AND t.archived_at IS NULL`).get(id));
  }

  listTeams() {
    return this.db.prepare(`${teamSelect} WHERE t.archived_at IS NULL ORDER BY t.updated_at DESC, t.id`).all().map(mapTeamRow);
  }

  listTeamVersions(teamId) {
    return this.db.prepare(`SELECT team_id AS id, id AS versionId, version, name, description,
      max_concurrency AS maxConcurrency, nodes_json AS nodesJson, budget_json AS budgetJson,
      created_by AS createdBy, created_at AS versionCreatedAt
      FROM team_versions WHERE team_id = ? ORDER BY version DESC`).all(teamId).map(mapTeamRow);
  }

  createRun({ teamId, objective, retryOfId = null, snapshot = null }, actor = "user") {
    const team = snapshot ? null : this.getTeam(teamId);
    if (!snapshot && !team) return null;
    const canonicalSnapshot = snapshot || {
      team: { id: team.id, versionId: team.versionId, version: team.version, name: team.name, description: team.description, maxConcurrency: team.maxConcurrency, budget: team.budget },
      nodes: team.nodes.map((node) => ({ ...node, agent: this.getAgentVersion(node.agentVersionId) })),
    };
    if (canonicalSnapshot.nodes.some((node) => !node.agent)) throw new Error("Snapshot impossible : version agent manquante");
    const id = randomUUID();
    const createdAt = this.clock();
    return this.transaction(() => {
      this.db.prepare(`INSERT INTO runs
        (id, team_id, team_version_id, retry_of_id, status, objective, snapshot_json,
         max_concurrency, total_workers, created_at)
        VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)`)
        .run(id, canonicalSnapshot.team.id, canonicalSnapshot.team.versionId, retryOfId,
          objective, safeJson(canonicalSnapshot), canonicalSnapshot.team.maxConcurrency,
          canonicalSnapshot.nodes.length, createdAt);
      for (const node of canonicalSnapshot.nodes) {
        this.db.prepare(`INSERT INTO run_workers
          (id, run_id, node_key, agent_version_id, attempt, status, created_at)
          VALUES (?, ?, ?, ?, 1, 'queued', ?)`)
          .run(randomUUID(), id, node.key, node.agentVersionId, createdAt);
      }
      this.runEvent({ runId: id, type: "run.queued", message: `${canonicalSnapshot.team.name} mis en file`, payload: { retryOfId, workers: canonicalSnapshot.nodes.length } });
      this.audit({ actor, action: retryOfId ? "run.retried" : "run.created", outcome: "success", targetType: "run", targetId: id, metadata: { teamVersionId: canonicalSnapshot.team.versionId, retryOfId } });
      return this.getRun(id);
    });
  }

  retryRun(sourceId, actor = "user") {
    const source = this.getRun(sourceId);
    if (!source || !["completed", "failed", "cancelled"].includes(source.status)) return null;
    return this.createRun({ teamId: source.teamId, objective: source.objective, retryOfId: source.id, snapshot: source.snapshot }, actor);
  }

  getRun(id) {
    return mapRunRow(this.db.prepare(`${runSelect} WHERE id = ?`).get(id));
  }

  listRuns(limit = 50) {
    const bounded = Math.max(1, Math.min(Number(limit) || 50, 100));
    return this.db.prepare(`${runSelect} ORDER BY created_at DESC LIMIT ?`).all(bounded).map(mapRunRow).map(summarizeRun);
  }

  listRunWorkers(runId) {
    return this.db.prepare(`SELECT id, run_id AS runId, node_key AS nodeKey,
      agent_version_id AS agentVersionId, attempt, status, session_id AS sessionId,
      output_json AS outputJson, error, tokens_used AS tokensUsed, cost_usd AS costUsd,
      created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt
      FROM run_workers WHERE run_id = ? ORDER BY node_key, attempt`).all(runId).map(mapWorkerRow);
  }

  latestRunWorkers(runId) {
    return this.db.prepare(`SELECT w.id, w.run_id AS runId, w.node_key AS nodeKey,
      w.agent_version_id AS agentVersionId, w.attempt, w.status, w.session_id AS sessionId,
      w.output_json AS outputJson, w.error, w.tokens_used AS tokensUsed, w.cost_usd AS costUsd,
      w.created_at AS createdAt, w.started_at AS startedAt, w.finished_at AS finishedAt
      FROM run_workers w JOIN (
        SELECT node_key, MAX(attempt) AS attempt FROM run_workers WHERE run_id = ? GROUP BY node_key
      ) latest ON latest.node_key = w.node_key AND latest.attempt = w.attempt
      WHERE w.run_id = ? ORDER BY w.created_at, w.node_key`).all(runId, runId).map(mapWorkerRow);
  }

  getRunDetail(id, eventLimit = 250) {
    const run = this.getRun(id);
    if (!run) return null;
    return {
      ...run,
      workers: this.listRunWorkers(id),
      currentWorkers: this.latestRunWorkers(id),
      events: this.listRunEvents(id, { limit: eventLimit }),
      artifacts: this.db.prepare(`SELECT id, run_id AS runId, worker_id AS workerId, name, kind, uri,
        bytes, checksum, created_at AS createdAt FROM run_artifacts WHERE run_id = ? ORDER BY created_at, id`).all(id),
    };
  }

  startRun(id) {
    const startedAt = this.clock();
    const changed = this.db.prepare(`UPDATE runs SET status = 'running', started_at = COALESCE(started_at, ?)
      WHERE id = ? AND status IN ('queued', 'degraded')`).run(startedAt, id).changes;
    if (changed) this.runEvent({ runId: id, type: "run.started", message: "Run démarré" });
    return changed > 0;
  }

  startWorker(id) {
    const startedAt = this.clock();
    const changed = this.db.prepare("UPDATE run_workers SET status = 'running', started_at = ? WHERE id = ? AND status = 'queued'").run(startedAt, id).changes;
    if (changed) {
      const worker = this.db.prepare("SELECT run_id AS runId, node_key AS nodeKey, attempt FROM run_workers WHERE id = ?").get(id);
      this.runEvent({ runId: worker.runId, workerId: id, type: "worker.started", message: `${worker.nodeKey} · tentative ${worker.attempt}` });
    }
    return changed > 0;
  }

  setWorkerSession(id, sessionId) {
    this.db.prepare("UPDATE run_workers SET session_id = ? WHERE id = ? AND status = 'running'").run(String(sessionId).slice(0, 128), id);
  }

  completeWorker(id, { output = {}, tokensUsed = null, costUsd = null } = {}) {
    const finishedAt = this.clock();
    const worker = this.db.prepare("SELECT run_id AS runId, node_key AS nodeKey FROM run_workers WHERE id = ?").get(id);
    if (!worker) return false;
    const changed = this.db.prepare(`UPDATE run_workers SET status = 'completed', output_json = ?,
      tokens_used = ?, cost_usd = ?, finished_at = ? WHERE id = ? AND status = 'running'`)
      .run(safeJson(output), tokensUsed, costUsd, finishedAt, id).changes;
    if (changed) this.runEvent({ runId: worker.runId, workerId: id, type: "worker.completed", message: `${worker.nodeKey} terminé`, payload: { tokensUsed, costUsd } });
    this.refreshRunMetrics(worker.runId);
    return changed > 0;
  }

  failWorker(id, error, status = "failed", { tokensUsed = null, costUsd = null } = {}) {
    const finishedAt = this.clock();
    const safeError = String(redact(String(error || "Erreur worker"))).slice(-1400);
    const worker = this.db.prepare("SELECT run_id AS runId, node_key AS nodeKey FROM run_workers WHERE id = ?").get(id);
    if (!worker) return false;
    const changed = this.db.prepare(`UPDATE run_workers SET status = ?, error = ?, tokens_used = ?, cost_usd = ?, finished_at = ?
      WHERE id = ? AND status IN ('queued', 'running')`).run(status, safeError, tokensUsed, costUsd, finishedAt, id).changes;
    if (changed) this.runEvent({ runId: worker.runId, workerId: id, type: `worker.${status}`, level: status === "cancelled" ? "warning" : "error", message: `${worker.nodeKey} · ${safeError}` });
    this.refreshRunMetrics(worker.runId);
    return changed > 0;
  }

  queueWorkerRetry(worker) {
    const id = randomUUID();
    const createdAt = this.clock();
    this.db.prepare(`INSERT INTO run_workers
      (id, run_id, node_key, agent_version_id, attempt, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'queued', ?)`)
      .run(id, worker.runId, worker.nodeKey, worker.agentVersionId, worker.attempt + 1, createdAt);
    this.runEvent({ runId: worker.runId, workerId: id, type: "worker.retry_queued", level: "warning", message: `${worker.nodeKey} · retry ${worker.attempt + 1}` });
    return mapWorkerRow(this.db.prepare(`SELECT id, run_id AS runId, node_key AS nodeKey,
      agent_version_id AS agentVersionId, attempt, status, session_id AS sessionId,
      output_json AS outputJson, error, tokens_used AS tokensUsed, cost_usd AS costUsd,
      created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt FROM run_workers WHERE id = ?`).get(id));
  }

  refreshRunMetrics(runId) {
    const latest = this.latestRunWorkers(runId);
    const completed = latest.filter((worker) => worker.status === "completed").length;
    const usage = this.db.prepare(`SELECT SUM(tokens_used) AS tokens, SUM(cost_usd) AS cost
      FROM run_workers WHERE run_id = ?`).get(runId);
    this.db.prepare("UPDATE runs SET completed_workers = ?, tokens_used = ?, cost_usd = ? WHERE id = ?")
      .run(completed, usage.tokens ?? null, usage.cost ?? null, runId);
  }

  requestRunCancel(id, actor = "user") {
    const requestedAt = this.clock();
    const changed = this.db.prepare(`UPDATE runs SET cancel_requested_at = ?
      WHERE id = ? AND status IN ('queued', 'running', 'degraded') AND cancel_requested_at IS NULL`).run(requestedAt, id).changes;
    if (changed) {
      this.runEvent({ runId: id, type: "run.cancel_requested", level: "warning", message: "Annulation demandée" });
      this.audit({ actor, action: "run.cancelled", outcome: "requested", targetType: "run", targetId: id });
    }
    return changed > 0;
  }

  finishRun(id, status, error = null) {
    if (!["completed", "failed", "cancelled"].includes(status)) throw new Error("Statut final invalide");
    const finishedAt = this.clock();
    const safeError = error ? String(redact(String(error))).slice(-1400) : null;
    const changed = this.db.prepare(`UPDATE runs SET status = ?, error = ?, finished_at = ?
      WHERE id = ? AND status IN ('queued', 'running', 'degraded')`).run(status, safeError, finishedAt, id).changes;
    if (changed) {
      if (status !== "completed") this.db.prepare(`UPDATE run_workers SET status = ?, error = COALESCE(error, ?), finished_at = ?
        WHERE run_id = ? AND status = 'queued'`).run(status === "cancelled" ? "cancelled" : "skipped", safeError, finishedAt, id);
      this.refreshRunMetrics(id);
      this.runEvent({ runId: id, type: `run.${status}`, level: status === "completed" ? "info" : status === "cancelled" ? "warning" : "error", message: status === "completed" ? "Run terminé" : safeError || `Run ${status}` });
    }
    return changed > 0;
  }

  runEvent({ runId, workerId = null, type, level = "info", message, payload = {} }) {
    const createdAt = this.clock();
    const safeMessage = String(redact(String(message))).slice(0, 1400);
    const result = this.db.prepare(`INSERT INTO run_events(run_id, worker_id, type, level, message, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(runId, workerId, type, level, safeMessage, safeJson(payload), createdAt);
    return { id: Number(result.lastInsertRowid), runId, workerId, type, level, message: safeMessage, payload: parseSafeJson(safeJson(payload)), createdAt };
  }

  listRunEvents(runId, { after = 0, limit = 250 } = {}) {
    const bounded = Math.max(1, Math.min(Number(limit) || 250, 1000));
    return this.db.prepare(`SELECT id, run_id AS runId, worker_id AS workerId, type, level,
      message, payload_json AS payloadJson, created_at AS createdAt
      FROM run_events WHERE run_id = ? AND id > ? ORDER BY id LIMIT ?`).all(runId, Number(after) || 0, bounded)
      .map(({ payloadJson, ...row }) => ({ ...row, payload: parseSafeJson(payloadJson) }));
  }

  addRunArtifact({ runId, workerId = null, name, kind = "artifact", uri, bytes = null, checksum = null }) {
    const id = randomUUID();
    const createdAt = this.clock();
    this.db.prepare(`INSERT INTO run_artifacts(id, run_id, worker_id, name, kind, uri, bytes, checksum, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, runId, workerId, String(name).slice(0, 200), String(kind).slice(0, 80), String(uri).slice(0, 1000), bytes, checksum, createdAt);
    this.runEvent({ runId, workerId, type: "artifact.created", message: `${name} ajouté`, payload: { artifactId: id, kind, uri } });
    return { id, runId, workerId, name, kind, uri, bytes, checksum, createdAt };
  }

  pendingRuns() {
    return this.db.prepare(`${runSelect} WHERE status IN ('queued', 'degraded') ORDER BY created_at`).all().map(mapRunRow);
  }

  reconcileStaleRuns() {
    const stale = this.db.prepare("SELECT id FROM runs WHERE status = 'running'").all();
    for (const { id } of stale) {
      const run = this.getRun(id);
      const running = this.latestRunWorkers(id).filter((worker) => worker.status === "running");
      let recoverable = true;
      for (const worker of running) {
        this.failWorker(worker.id, "Tentative interrompue par un redémarrage du control-plane");
        const node = run.snapshot.nodes.find((candidate) => candidate.key === worker.nodeKey);
        if (worker.attempt <= (node?.agent?.budget?.maxRetries ?? 0)) this.queueWorkerRetry(worker);
        else recoverable = false;
      }
      if (recoverable) {
        this.db.prepare("UPDATE runs SET status = 'degraded' WHERE id = ?").run(id);
        this.runEvent({ runId: id, type: "run.recovered", level: "warning", message: "Run repris après redémarrage" });
      } else this.finishRun(id, "failed", "Budget de retries épuisé après redémarrage");
    }
    return stale.length;
  }

  observatory() {
    const statusRows = this.db.prepare("SELECT status, COUNT(*) AS count FROM runs GROUP BY status").all();
    const statuses = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count)]));
    const usage = this.db.prepare("SELECT SUM(tokens_used) AS tokens, SUM(cost_usd) AS cost FROM runs").get();
    const terminal = Number((statuses.completed || 0) + (statuses.failed || 0));
    return {
      generatedAt: this.clock(),
      agents: Number(this.db.prepare("SELECT COUNT(*) AS count FROM agents WHERE archived_at IS NULL").get().count),
      teams: Number(this.db.prepare("SELECT COUNT(*) AS count FROM teams WHERE archived_at IS NULL").get().count),
      statuses,
      activeWorkers: this.db.prepare(`SELECT w.id, w.run_id AS runId, w.node_key AS nodeKey, w.status,
        v.name AS agentName, v.color, r.objective, w.started_at AS startedAt
        FROM run_workers w JOIN agent_versions v ON v.id = w.agent_version_id JOIN runs r ON r.id = w.run_id
        WHERE w.status = 'running' ORDER BY w.started_at LIMIT 12`).all(),
      recentRuns: this.listRuns(8),
      usage: { tokens: usage.tokens ?? null, costUsd: usage.cost ?? null },
      successRate: terminal ? Number((((statuses.completed || 0) / terminal) * 100).toFixed(1)) : null,
      activity: this.recentActivity(8),
    };
  }

  createJob({ kind, title, input = {} }) {
    const id = randomUUID();
    const createdAt = this.clock();
    return this.transaction(() => {
      this.db.prepare(`INSERT INTO jobs(id, kind, status, title, input_json, created_at, started_at)
        VALUES (?, ?, 'running', ?, ?, ?, ?)`).run(id, kind, title, safeJson(input), createdAt, createdAt);
      this.event({ jobId: id, type: "job.started", level: "info", message: `${title} démarré` });
      return { id, kind, status: "running", title, createdAt, startedAt: createdAt };
    });
  }

  completeJob(id, output = {}) {
    return this.transaction(() => {
      const finishedAt = this.clock();
      this.db.prepare(`UPDATE jobs SET status = 'completed', output_json = ?, finished_at = ?
        WHERE id = ? AND status = 'running'`).run(safeJson(output), finishedAt, id);
      this.event({ jobId: id, type: "job.completed", level: "info", message: "Job terminé" });
      return finishedAt;
    });
  }

  failJob(id, error) {
    return this.transaction(() => {
      const finishedAt = this.clock();
      const safeError = String(redact(String(error || "Erreur inconnue"))).slice(-1400);
      this.db.prepare(`UPDATE jobs SET status = 'failed', error = ?, finished_at = ?
        WHERE id = ? AND status = 'running'`).run(safeError, finishedAt, id);
      this.event({ jobId: id, type: "job.failed", level: "error", message: safeError });
      return finishedAt;
    });
  }

  event({ jobId = null, type, level = "info", message, payload = {} }) {
    const createdAt = this.clock();
    const safeMessage = String(redact(String(message))).slice(0, 1400);
    const result = this.db.prepare(`INSERT INTO events(job_id, type, level, message, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(jobId, type, level, safeMessage, safeJson(payload), createdAt);
    return { id: Number(result.lastInsertRowid), jobId, type, level, message: safeMessage, payload: JSON.parse(safeJson(payload)), createdAt };
  }

  reconcileStaleJobs() {
    const stale = this.db.prepare("SELECT id FROM jobs WHERE status = 'running'").all();
    if (!stale.length) return 0;
    return this.transaction(() => {
      const finishedAt = this.clock();
      for (const { id } of stale) {
        this.db.prepare("UPDATE jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?")
          .run("Interrompu par un redémarrage du control-plane", finishedAt, id);
        this.event({ jobId: id, type: "job.reconciled", level: "warning", message: "Job interrompu réconcilié au démarrage" });
      }
      return stale.length;
    });
  }

  createDecision({ jobId = null, risk, title, detail }) {
    const id = randomUUID();
    const createdAt = this.clock();
    this.db.prepare(`INSERT INTO decisions(id, job_id, status, risk, title, detail, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?)`).run(id, jobId, risk, title.slice(0, 200), detail.slice(0, 1400), createdAt);
    this.event({ jobId, type: "decision.requested", level: "warning", message: title, payload: { decisionId: id, risk } });
    return { id, jobId, status: "pending", risk, title, detail, createdAt };
  }

  resolveDecision(id, status) {
    if (status !== "approved" && status !== "rejected" && status !== "expired") throw new Error("Statut de décision invalide");
    const resolvedAt = this.clock();
    const changed = this.db.prepare("UPDATE decisions SET status = ?, resolved_at = ? WHERE id = ? AND status = 'pending'").run(status, resolvedAt, id).changes;
    if (changed) this.event({ type: "decision.resolved", message: `Décision ${status}`, payload: { decisionId: id, status } });
    return changed > 0;
  }

  audit({ actor = "system", action, outcome, targetType = null, targetId = null, metadata = {} }) {
    const createdAt = this.clock();
    const result = this.db.prepare(`INSERT INTO audit_entries(actor, action, outcome, target_type, target_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(actor, action, outcome, targetType, targetId, safeJson(metadata), createdAt);
    return Number(result.lastInsertRowid);
  }

  counts() {
    const count = (table, where = "") => Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`).get().count);
    const activeSessions = Number(this.db.prepare("SELECT COUNT(*) AS count FROM access_sessions WHERE revoked_at IS NULL AND expires_at > ?").get(this.clock()).count);
    return {
      activeSessions,
      conversations: count("conversations", "WHERE archived_at IS NULL"),
      messages: count("messages"),
      jobs: count("jobs"),
      runningJobs: count("jobs", "WHERE status = 'running'"),
      events: count("events"),
      pendingDecisions: count("decisions", "WHERE status = 'pending'"),
      auditEntries: count("audit_entries"),
      agents: count("agents", "WHERE archived_at IS NULL"),
      teams: count("teams", "WHERE archived_at IS NULL"),
      runs: count("runs"),
      runningRuns: count("runs", "WHERE status IN ('running', 'degraded')"),
    };
  }

  recentActivity(limit = 20) {
    const bounded = Math.max(1, Math.min(Number(limit) || 20, 100));
    return this.db.prepare(`SELECT id, job_id AS jobId, type, level, message, payload_json AS payloadJson,
      created_at AS createdAt FROM events ORDER BY id DESC LIMIT ?`).all(bounded)
      .map(({ payloadJson, ...row }) => ({ ...row, payload: parseSafeJson(payloadJson) }));
  }
}
