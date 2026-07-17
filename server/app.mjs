import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { createAuth } from "./auth.mjs";
import { loadConfig } from "./config.mjs";
import { openDatabase } from "./database.mjs";
import { json, readJson, sameOrigin, securityHeaders, serveStatic, unauthorized } from "./http.mjs";
import { createRuntimeBridge } from "./runtimes.mjs";
import { assertAllowed } from "./policies.mjs";
import { parseAgent, parseChatInput, parseConversationInput, ValidationError } from "./schemas.mjs";
import { redact } from "./security.mjs";
import { ControlPlaneStore } from "./store.mjs";
import { createSystemService } from "./system.mjs";
import { createVibeApiHandler, createVibeClient } from "./vibe.mjs";

function errorResponse(res, error, fallbackStatus = 500) {
  const validation = error instanceof ValidationError;
  const status = validation ? 400 : fallbackStatus;
  const message = String(error?.message || error || "Erreur interne").slice(-1400);
  return json(res, status, { error: message, code: validation ? error.code : status === 404 ? "not_found" : "request_failed" });
}

function displayTitle(message) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 69)}…` : compact;
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
  const system = createSystemService({ db, databasePath, dataDirectory, store, version: packageJson.version, vibeClient: vibe });
  const handleVibe = createVibeApiHandler(vibe);
  const activeAgents = new Set();

  let vite;
  if (config.isDev) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ appType: "spa", server: { middlewareMode: true, allowedHosts: true } });
  }

  async function handleApi(req, res, url, authContext) {
    if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "Origine refusée", code: "origin_denied" });

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
      if (!conversation) return json(res, 404, { error: "Conversation introuvable", code: "not_found" });
      return json(res, 200, { ok: true, conversation, messages: store.listMessages(conversation.id) });
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      let input;
      try {
        input = parseChatInput(await readJson(req));
      } catch (error) {
        return errorResponse(res, error, 400);
      }
      if (activeAgents.has(input.agent)) return json(res, 409, { error: `${input.agent === "pi" ? "PI" : "Codex"} traite déjà une demande`, code: "agent_busy" });
      assertAllowed(`chat.${input.mode}`);

      let conversation = input.conversationId ? store.getConversation(input.conversationId) : null;
      if (input.conversationId && !conversation) return json(res, 404, { error: "Conversation introuvable", code: "not_found" });
      if (conversation && conversation.agent !== input.agent) return json(res, 400, { error: "La conversation appartient à un autre agent", code: "agent_mismatch" });
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
        if (result.sessionReset) store.event({ jobId: job.id, type: "runtime.session_reset", level: "warning", message: "Session runtime recréée après disparition du rollout" });
        store.completeJob(job.id, { safety: result.safety, sessionReset: result.sessionReset });
        store.audit({ actor: "user", action: "chat.executed", outcome: "success", targetType: "conversation", targetId: conversation.id, metadata: { agent: input.agent, mode: input.mode, jobId: job.id } });
        return json(res, 200, { ok: true, ...result, sessionId: undefined, conversationId: conversation.id, jobId: job.id });
      } catch (error) {
        const safeError = String(redact(String(error?.message || error))).slice(-1400);
        store.addMessage({ conversationId: conversation.id, role: "system", mode: input.mode, content: `${input.agent === "pi" ? "PI" : "Codex"} non joignable : ${safeError}` });
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
      if (!res.headersSent) return json(res, badRequest ? 400 : 500, { error: badRequest ? "URL invalide" : "Erreur interne" });
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
    server,
    async close() {
      if (vite) await vite.close();
      db.close();
    },
  };
}
