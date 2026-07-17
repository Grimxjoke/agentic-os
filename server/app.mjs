import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { createAuth } from "./auth.mjs";
import { loadConfig } from "./config.mjs";
import { openDatabase } from "./database.mjs";
import { json, readJson, sameOrigin, securityHeaders, serveStatic, unauthorized } from "./http.mjs";
import { createRunOrchestrator, createVibeWorkerExecutor } from "./orchestrator.mjs";
import { createRuntimeBridge } from "./runtimes.mjs";
import { assertAllowed } from "./policies.mjs";
import { parseAgent, parseAgentDefinitionInput, parseChatInput, parseConversationInput, parseRunInput, parseTeamDefinitionInput, ValidationError } from "./schemas.mjs";
import { redact } from "./security.mjs";
import { ControlPlaneStore } from "./store.mjs";
import { createSystemService } from "./system.mjs";
import { createVibeApiHandler, createVibeClient } from "./vibe.mjs";

function errorResponse(res, error, fallbackStatus = 500) {
  const validation = error instanceof ValidationError;
  const status = validation ? 400 : fallbackStatus;
  const message = String(error?.message || error || "Internal error").slice(-1400);
  return json(res, status, { error: message, code: validation ? error.code : status === 404 ? "not_found" : "request_failed" });
}

function displayTitle(message) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 69)}…` : compact;
}

function streamRunEvents(req, res, runId, store) {
  if (!store.getRun(runId)) return json(res, 404, { error: "Run not found", code: "not_found" });
  let cursor = Math.max(0, Number(req.headers["last-event-id"] || 0) || 0);
  res.writeHead(200, securityHeaders({
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  }));
  let timer;
  let lastWrite = Date.now();
  const flush = () => {
    const events = store.listRunEvents(runId, { after: cursor, limit: 250 });
    for (const event of events) {
      cursor = event.id;
      res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      lastWrite = Date.now();
    }
    const run = store.getRun(runId);
    if (run && ["completed", "failed", "cancelled"].includes(run.status) && events.length === 0) {
      clearInterval(timer);
      res.end();
    } else if (!events.length && Date.now() - lastWrite > 15_000) {
      res.write(": keepalive\n\n");
      lastWrite = Date.now();
    }
  };
  timer = setInterval(flush, 250);
  timer.unref?.();
  req.on("close", () => clearInterval(timer));
  flush();
}

export async function createOrbitApplication(overrides = {}) {
  const config = loadConfig(overrides);
  const { db, directory: dataDirectory, path: databasePath } = await openDatabase({
    dataDirectory: config.dataDirectory,
    databasePath: config.databasePath,
  });
  const packageJson = JSON.parse(await readFile(join(config.root, "package.json"), "utf8"));
  const store = new ControlPlaneStore(db, config.clock);
  store.reconcileStaleJobs();
  const auth = createAuth({ accessToken: config.accessToken, store });
  const runtimes = config.runtimes || createRuntimeBridge({ workspace: config.workspace });
  const vibe = config.vibeClient || createVibeClient({ baseUrl: config.vibeBaseUrl, apiKey: config.vibeApiKey });
  const runExecutor = overrides.runExecutor || createVibeWorkerExecutor(vibe);
  const orchestrator = createRunOrchestrator({ store, executor: runExecutor, maxConcurrency: 2 });
  orchestrator.recover();
  const system = createSystemService({ db, databasePath, dataDirectory, store, version: packageJson.version, vibeClient: vibe });
  const handleVibe = createVibeApiHandler(vibe);
  const activeAgents = new Set();

  let vite;
  if (config.isDev) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ appType: "spa", server: { middlewareMode: true, allowedHosts: true } });
  }

  async function handleApi(req, res, url, authContext) {
    if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "Origin refused", code: "origin_denied" });

    if (url.pathname.startsWith("/api/vibe/")) return handleVibe(req, res, url);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true, status: "operational", agents: { pi: "read-only", codex: "sandboxed" } });
    }
    if (req.method === "GET" && url.pathname === "/api/session") {
      return json(res, 200, { ok: true, session: authContext.session ? { ...authContext.session, revokedAt: undefined } : { legacy: true } });
    }
    if (req.method === "DELETE" && url.pathname === "/api/session") {
      assertAllowed("session.revoke");
      if (authContext.session) store.revokeAccessSession(authContext.session.id);
      return json(res, 200, { ok: true }, { "Set-Cookie": auth.clearCookies(req) });
    }
    if (req.method === "GET" && url.pathname === "/api/system/overview") {
      return json(res, 200, { ok: true, ...(await system.overview()) });
    }
    if (req.method === "POST" && url.pathname === "/api/system/backups") {
      assertAllowed("database.backup");
      return json(res, 201, { ok: true, backup: await system.createBackup() });
    }
    if (req.method === "GET" && url.pathname === "/api/activity") {
      return json(res, 200, { ok: true, activity: store.recentActivity(url.searchParams.get("limit")) });
    }
    if (req.method === "GET" && url.pathname === "/api/observatory") {
      return json(res, 200, { ok: true, observatory: store.observatory() });
    }
    if (req.method === "GET" && url.pathname === "/api/agents") {
      return json(res, 200, { ok: true, agents: store.listAgents() });
    }
    if (req.method === "POST" && url.pathname === "/api/agents") {
      try {
        assertAllowed("agents.write");
        const agent = store.createAgent(parseAgentDefinitionInput(await readJson(req)));
        return json(res, 201, { ok: true, agent });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    const agentVersionsMatch = /^\/api\/agents\/([0-9a-f-]{36})\/versions$/i.exec(url.pathname);
    if (req.method === "GET" && agentVersionsMatch) {
      const agent = store.getAgent(agentVersionsMatch[1]);
      if (!agent) return json(res, 404, { error: "Agent not found", code: "not_found" });
      return json(res, 200, { ok: true, agent, versions: store.listAgentVersions(agent.id) });
    }
    if (req.method === "POST" && agentVersionsMatch) {
      try {
        assertAllowed("agents.write");
        const agent = store.createAgentVersion(agentVersionsMatch[1], parseAgentDefinitionInput(await readJson(req)));
        if (!agent) return json(res, 404, { error: "Agent not found", code: "not_found" });
        return json(res, 201, { ok: true, agent });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    if (req.method === "GET" && url.pathname === "/api/teams") {
      return json(res, 200, { ok: true, teams: store.listTeams() });
    }
    if (req.method === "POST" && url.pathname === "/api/teams") {
      try {
        assertAllowed("teams.write");
        const team = store.createTeam(parseTeamDefinitionInput(await readJson(req)));
        return json(res, 201, { ok: true, team });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    const teamVersionsMatch = /^\/api\/teams\/([0-9a-f-]{36})\/versions$/i.exec(url.pathname);
    if (req.method === "GET" && teamVersionsMatch) {
      const team = store.getTeam(teamVersionsMatch[1]);
      if (!team) return json(res, 404, { error: "Team not found", code: "not_found" });
      return json(res, 200, { ok: true, team, versions: store.listTeamVersions(team.id) });
    }
    if (req.method === "POST" && teamVersionsMatch) {
      try {
        assertAllowed("teams.write");
        const team = store.createTeamVersion(teamVersionsMatch[1], parseTeamDefinitionInput(await readJson(req)));
        if (!team) return json(res, 404, { error: "Team not found", code: "not_found" });
        return json(res, 201, { ok: true, team });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    if (req.method === "GET" && url.pathname === "/api/runs") {
      return json(res, 200, { ok: true, runs: store.listRuns(url.searchParams.get("limit")) });
    }
    if (req.method === "POST" && url.pathname === "/api/runs") {
      try {
        assertAllowed("runs.start");
        const input = parseRunInput(await readJson(req));
        const run = store.createRun(input);
        if (!run) return json(res, 404, { error: "Team not found", code: "not_found" });
        orchestrator.start(run.id);
        return json(res, 202, { ok: true, run });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    const runEventsMatch = /^\/api\/runs\/([0-9a-f-]{36})\/events$/i.exec(url.pathname);
    if (req.method === "GET" && runEventsMatch) return streamRunEvents(req, res, runEventsMatch[1], store);
    const runActionMatch = /^\/api\/runs\/([0-9a-f-]{36})\/(cancel|retry)$/i.exec(url.pathname);
    if (req.method === "POST" && runActionMatch) {
      const [, runId, action] = runActionMatch;
      const run = store.getRun(runId);
      if (!run) return json(res, 404, { error: "Run not found", code: "not_found" });
      if (action === "cancel") {
        assertAllowed("runs.cancel");
        if (!store.requestRunCancel(runId)) return json(res, 409, { error: "This run can no longer be canceled", code: "run_terminal" });
        orchestrator.cancel(runId);
        return json(res, 202, { ok: true });
      }
      assertAllowed("runs.retry");
      const retried = store.retryRun(runId);
      if (!retried) return json(res, 409, { error: "Only a completed run can be restarted", code: "run_not_terminal" });
      orchestrator.start(retried.id);
      return json(res, 202, { ok: true, run: retried });
    }
    const runMatch = /^\/api\/runs\/([0-9a-f-]{36})$/i.exec(url.pathname);
    if (req.method === "GET" && runMatch) {
      const run = store.getRunDetail(runMatch[1]);
      return run ? json(res, 200, { ok: true, run }) : json(res, 404, { error: "Run not found", code: "not_found" });
    }
    if (req.method === "GET" && url.pathname === "/api/conversations") {
      try {
        return json(res, 200, { ok: true, conversations: store.listConversations(parseAgent(url.searchParams.get("agent"))) });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    if (req.method === "POST" && url.pathname === "/api/conversations") {
      try {
        const conversation = store.createConversation(parseConversationInput(await readJson(req)));
        return json(res, 201, { ok: true, conversation });
      } catch (error) {
        return errorResponse(res, error, 400);
      }
    }
    const messagesMatch = /^\/api\/conversations\/([0-9a-f-]{36})\/messages$/i.exec(url.pathname);
    if (req.method === "GET" && messagesMatch) {
      const conversation = store.getConversation(messagesMatch[1]);
      if (!conversation) return json(res, 404, { error: "Conversation not found", code: "not_found" });
      return json(res, 200, { ok: true, conversation, messages: store.listMessages(conversation.id) });
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      let input;
      try {
        input = parseChatInput(await readJson(req));
      } catch (error) {
        return errorResponse(res, error, 400);
      }
      if (activeAgents.has(input.agent)) return json(res, 409, { error: `${input.agent === "pi" ? "PI" : "Codex"}already processing a request`, code: "agent_busy" });
      assertAllowed(`chat.${input.mode}`);

      let conversation = input.conversationId ? store.getConversation(input.conversationId) : null;
      if (input.conversationId && !conversation) return json(res, 404, { error: "Conversation not found", code: "not_found" });
      if (conversation && conversation.agent !== input.agent) return json(res, 400, { error: "The conversation belongs to another agent", code: "agent_mismatch" });
      if (!conversation) conversation = store.createConversation({ agent: input.agent, title: displayTitle(input.message) });

      store.addMessage({ conversationId: conversation.id, role: "user", mode: input.mode, content: input.message });
      const job = store.createJob({
        kind: `chat.${input.agent}`,
        title: `${input.agent === "pi" ? "PI" : "Codex"} · ${input.mode}`,
        input: { agent: input.agent, mode: input.mode, conversationId: conversation.id },
      });
      activeAgents.add(input.agent);
      try {
        const result = await runtimes[input.agent]({
          message: input.message,
          mode: input.mode,
          sessionId: conversation.runtimeSessionId || input.legacySessionId,
        });
        store.addMessage({ conversationId: conversation.id, role: "assistant", mode: input.mode, content: result.reply });
        store.setRuntimeSession(conversation.id, result.sessionId);
        if (result.sessionReset) store.event({ jobId: job.id, type: "runtime.session_reset", level: "warning", message: "Runtime session recreated after rollout disappears" });
        store.completeJob(job.id, { safety: result.safety, sessionReset: result.sessionReset });
        store.audit({ actor: "user", action: "chat.executed", outcome: "success", targetType: "conversation", targetId: conversation.id, metadata: { agent: input.agent, mode: input.mode, jobId: job.id } });
        return json(res, 200, { ok: true, ...result, sessionId: undefined, conversationId: conversation.id, jobId: job.id });
      } catch (error) {
        const safeError = String(redact(String(error?.message || error))).slice(-1400);
        store.addMessage({ conversationId: conversation.id, role: "system", mode: input.mode, content: `${input.agent === "pi" ? "PI" : "Codex"} unavailable: ${safeError}` });
        store.failJob(job.id, safeError);
        store.audit({ actor: "user", action: "chat.executed", outcome: "failure", targetType: "conversation", targetId: conversation.id, metadata: { agent: input.agent, mode: input.mode, jobId: job.id } });
        return json(res, 502, { ok: false, error: safeError, code: "runtime_failed", conversationId: conversation.id, jobId: job.id });
      } finally {
        activeAgents.delete(input.agent);
      }
    }
    return json(res, 404, { error: "Route inconnue", code: "not_found" });
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const isLiveness = url.pathname === "/healthz" || url.pathname === `${config.basePath}/healthz`;
      const isReadiness = url.pathname === "/readyz" || url.pathname === `${config.basePath}/readyz`;
      if (req.method === "GET" && isLiveness) return json(res, 200, { ok: true, status: "alive" });
      if (req.method === "GET" && isReadiness) {
        try {
          db.prepare("SELECT 1").get();
          if (!config.isDev) await access(join(config.root, "dist", "index.html"));
          return json(res, 200, { ok: true, status: "ready" });
        } catch {
          return json(res, 503, { ok: false, status: "not_ready" });
        }
      }

      const queryToken = url.searchParams.get("access") || "";
      if (queryToken && auth.accessMatches(queryToken)) {
        const established = auth.establish(req);
        url.searchParams.delete("access");
        res.writeHead(302, securityHeaders({ Location: `${url.pathname}${url.search}`, "Cache-Control": "no-store", "Set-Cookie": established.cookies }));
        return res.end();
      }

      const authContext = auth.authenticate(req);
      if (!authContext) return unauthorized(res, url.pathname);
      if (authContext.legacy && req.method === "GET") {
        const established = auth.establish(req);
        res.writeHead(302, securityHeaders({ Location: `${url.pathname}${url.search}`, "Cache-Control": "no-store", "Set-Cookie": established.cookies }));
        return res.end();
      }
      if (url.pathname === "/" || url.pathname === config.basePath) {
        res.writeHead(302, securityHeaders({ Location: `${config.basePath}/`, "Cache-Control": "no-store" }));
        return res.end();
      }
      const routedPath = url.pathname.startsWith(`${config.basePath}/`) ? url.pathname.slice(config.basePath.length) : url.pathname;
      if (routedPath.startsWith("/api/")) {
        const routedUrl = new URL(url);
        routedUrl.pathname = routedPath;
        return await handleApi(req, res, routedUrl, authContext);
      }
      if (vite) return vite.middlewares(req, res, () => json(res, 404, { error: "Introuvable" }));
      return await serveStatic(req, res, url, config);
    } catch (error) {
      const badRequest = error instanceof URIError;
      console.error("Orbit request failed", badRequest ? "invalid-uri" : error);
      if (!res.headersSent) return json(res, badRequest ? 400 : 500, { error: badRequest ? "Invalid URL" : "Internal error" });
      return res.end();
    }
  });

  server.on("error", (error) => {
    console.error("Orbit server error", error);
    process.exitCode = 1;
  });

  return {
    config,
    db,
    store,
    orchestrator,
    server,
    async close() {
      await orchestrator.shutdown();
      if (vite) await vite.close();
      db.close();
    },
  };
}
