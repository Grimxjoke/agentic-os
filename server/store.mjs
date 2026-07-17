import { randomUUID } from "node:crypto";
import { parseSafeJson, redact, safeJson } from "./security.mjs";

const now = () => new Date().toISOString();

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
    };
  }

  recentActivity(limit = 20) {
    const bounded = Math.max(1, Math.min(Number(limit) || 20, 100));
    return this.db.prepare(`SELECT id, job_id AS jobId, type, level, message, payload_json AS payloadJson,
      created_at AS createdAt FROM events ORDER BY id DESC LIMIT ?`).all(bounded)
      .map(({ payloadJson, ...row }) => ({ ...row, payload: parseSafeJson(payloadJson) }));
  }
}
