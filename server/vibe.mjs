import { Readable } from "node:stream";
import { json, readJson, securityHeaders } from "./http.mjs";
import { redact } from "./security.mjs";

const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
const JSON_LIMIT = 2 * 1024 * 1024;
const UPLOAD_LIMIT = 50 * 1024 * 1024 + 64 * 1024;
const CLEANUP = Symbol("vibeRequestCleanup");

export class VibeError extends Error {
  constructor(message, status = 502, code = "vibe_unavailable") {
    super(message);
    this.name = "VibeError";
    this.status = status;
    this.code = code;
  }
}

function safeMessage(value, fallback = "Vibe-Trading est indisponible") {
  return String(redact(String(value || fallback))).replace(/\s+/g, " ").slice(-800);
}

function assertIdentifier(value, kind) {
  if (!IDENTIFIER.test(value || "")) throw new VibeError(`${kind} invalide`, 400, "invalid_identifier");
}

function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new VibeError("Fichier trop volumineux", 413, "payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readVibeJson(req) {
  try {
    return await readJson(req);
  } catch (error) {
    throw new VibeError(error?.message || "Corps JSON invalide", 400, "invalid_body");
  }
}

export function createVibeClient(options = {}) {
  const baseUrl = new URL(options.baseUrl || "http://127.0.0.1:8899");
  const allowedHosts = new Set(["127.0.0.1", "::1", "localhost"]);
  if (baseUrl.protocol !== "http:" || !allowedHosts.has(baseUrl.hostname)) {
    throw new Error("VIBE_BASE_URL doit cibler un service HTTP loopback");
  }
  const apiKey = String(options.apiKey || "");
  const timeoutMs = Number(options.timeoutMs || 12_000);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  async function upstream(path, init = {}, { timeout = timeoutMs } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    timer.unref?.();
    const headers = new Headers(init.headers || {});
    headers.set("Accept", init.accept || "application/json");
    if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
    try {
      const response = await fetchImpl(new URL(path, baseUrl), { ...init, headers, signal: controller.signal });
      response[CLEANUP] = () => clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      const timedOut = error?.name === "AbortError";
      throw new VibeError(timedOut ? "Délai Vibe-Trading dépassé" : "Vibe-Trading ne répond pas", timedOut ? 504 : 502, timedOut ? "vibe_timeout" : "vibe_unavailable");
    }
  }

  async function request(path, init = {}, options = {}) {
    try {
      const response = await upstream(path, init, options);
      try {
        const length = Number(response.headers.get("content-length") || 0);
        if (length > JSON_LIMIT) throw new VibeError("Réponse Vibe-Trading trop volumineuse", 502, "upstream_too_large");
        const text = await response.text();
        if (Buffer.byteLength(text) > JSON_LIMIT) throw new VibeError("Réponse Vibe-Trading trop volumineuse", 502, "upstream_too_large");
        let payload = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          throw new VibeError("Réponse Vibe-Trading invalide", 502, "invalid_upstream_response");
        }
        if (!response.ok) {
          const detail = typeof payload.detail === "string" ? payload.detail : typeof payload.error === "string" ? payload.error : `Erreur Vibe-Trading (${response.status})`;
          throw new VibeError(safeMessage(detail), response.status >= 500 ? 502 : response.status, "vibe_request_failed");
        }
        return payload;
      } finally {
        response[CLEANUP]?.();
      }
    } catch (error) {
      if (error instanceof VibeError) throw error;
      const timedOut = error?.name === "AbortError";
      throw new VibeError(timedOut ? "Délai Vibe-Trading dépassé" : "Réponse Vibe-Trading interrompue", timedOut ? 504 : 502, timedOut ? "vibe_timeout" : "vibe_unavailable");
    }
  }

  async function overview() {
    let live;
    try {
      live = await request("/health");
    } catch (error) {
      if (error instanceof VibeError) {
        return { engine: "offline", ready: false, provider: null, version: null, reason: error.message };
      }
      throw error;
    }
    let ready = true;
    let reason = "ready";
    try {
      await request("/ready");
    } catch (error) {
      ready = false;
      reason = safeMessage(error.message, "Provider non prêt");
    }
    const [metadata, settings] = await Promise.all([
      request("/api").catch(() => ({})),
      request("/settings/llm").catch(() => ({})),
    ]);
    return {
      engine: live.status === "healthy" ? "online" : "degraded",
      ready,
      reason,
      version: metadata.version || null,
      provider: settings.provider ? {
        name: settings.provider,
        model: settings.model_name || null,
        authType: settings.api_key_required === false ? "oauth" : "api_key",
        authorized: Boolean(settings.api_key_configured),
      } : null,
    };
  }

  function jsonInit(method, body) {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    };
  }

  return {
    overview,
    request,
    sessions: {
      list: (limit = 50) => request(`/sessions?limit=${Math.min(Math.max(Number(limit) || 50, 1), 200)}`),
      create: (body) => request("/sessions", jsonInit("POST", body)),
      get: (id) => { assertIdentifier(id, "Session"); return request(`/sessions/${id}`); },
      update: (id, body) => { assertIdentifier(id, "Session"); return request(`/sessions/${id}`, jsonInit("PATCH", body)); },
      remove: (id) => { assertIdentifier(id, "Session"); return request(`/sessions/${id}`, { method: "DELETE" }); },
      messages: (id, limit = 250) => { assertIdentifier(id, "Session"); return request(`/sessions/${id}/messages?limit=${Math.min(Math.max(Number(limit) || 250, 1), 1000)}`); },
      send: (id, body) => { assertIdentifier(id, "Session"); return request(`/sessions/${id}/messages`, jsonInit("POST", body), { timeout: 20_000 }); },
      cancel: (id) => { assertIdentifier(id, "Session"); return request(`/sessions/${id}/cancel`, { method: "POST" }); },
      stream: (id, lastEventId, replay) => {
        assertIdentifier(id, "Session");
        const query = new URLSearchParams();
        if (lastEventId) query.set("Last-Event-ID", String(lastEventId).slice(0, 128));
        if (replay === "all") query.set("replay", "all");
        return upstream(`/sessions/${id}/events?${query}`, { accept: "text/event-stream" }, { timeout: 12_000 }).then((response) => {
          response[CLEANUP]?.();
          return response;
        });
      },
    },
    skills: () => request("/skills"),
    presets: () => request("/swarm/presets"),
    runs: (limit = 20) => request(`/runs?limit=${Math.min(Math.max(Number(limit) || 20, 1), 100)}`),
    upload: (contentType, body) => request("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }, { timeout: 60_000 }),
  };
}

function relaySse(res, upstreamResponse) {
  if (!upstreamResponse.ok || !upstreamResponse.body) {
    throw new VibeError(`Flux Vibe-Trading indisponible (${upstreamResponse.status})`, 502, "vibe_stream_failed");
  }
  res.writeHead(200, securityHeaders({
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  }));
  const stream = Readable.fromWeb(upstreamResponse.body);
  res.on("close", () => stream.destroy());
  stream.on("error", () => res.end());
  stream.pipe(res);
}

export function createVibeApiHandler(client) {
  return async function handleVibe(req, res, url) {
    try {
      const path = url.pathname;
      if (req.method === "GET" && path === "/api/vibe/overview") return json(res, 200, { ok: true, vibe: await client.overview() });
      if (req.method === "GET" && path === "/api/vibe/skills") return json(res, 200, { ok: true, skills: await client.skills() });
      if (req.method === "GET" && path === "/api/vibe/presets") return json(res, 200, { ok: true, presets: await client.presets() });
      if (req.method === "GET" && path === "/api/vibe/runs") return json(res, 200, { ok: true, runs: await client.runs(url.searchParams.get("limit")) });
      if (req.method === "GET" && path === "/api/vibe/sessions") return json(res, 200, { ok: true, sessions: await client.sessions.list(url.searchParams.get("limit")) });
      if (req.method === "POST" && path === "/api/vibe/sessions") {
        const body = await readVibeJson(req);
        const title = String(body.title || "Nouvelle recherche").trim().slice(0, 160);
        return json(res, 201, { ok: true, session: await client.sessions.create({ title, config: body.config || undefined }) });
      }
      if (req.method === "POST" && path === "/api/vibe/upload") {
        const contentType = String(req.headers["content-type"] || "");
        if (!contentType.startsWith("multipart/form-data;")) throw new VibeError("Upload multipart requis", 400, "invalid_upload");
        const body = await readBuffer(req, UPLOAD_LIMIT);
        return json(res, 201, { ok: true, upload: await client.upload(contentType, body) });
      }
      const events = /^\/api\/vibe\/sessions\/([A-Za-z0-9_-]+)\/events$/.exec(path);
      if (req.method === "GET" && events) {
        const response = await client.sessions.stream(events[1], req.headers["last-event-id"] || url.searchParams.get("lastEventId"), url.searchParams.get("replay"));
        return relaySse(res, response);
      }
      const messages = /^\/api\/vibe\/sessions\/([A-Za-z0-9_-]+)\/messages$/.exec(path);
      if (messages && req.method === "GET") return json(res, 200, { ok: true, messages: await client.sessions.messages(messages[1], url.searchParams.get("limit")) });
      if (messages && req.method === "POST") {
        const body = await readVibeJson(req);
        const content = String(body.content || "").trim();
        if (!content || content.length > 5000) throw new VibeError("Le message doit contenir entre 1 et 5 000 caractères", 400, "invalid_message");
        return json(res, 202, { ok: true, result: await client.sessions.send(messages[1], { content }) });
      }
      const cancel = /^\/api\/vibe\/sessions\/([A-Za-z0-9_-]+)\/cancel$/.exec(path);
      if (req.method === "POST" && cancel) return json(res, 200, { ok: true, result: await client.sessions.cancel(cancel[1]) });
      const session = /^\/api\/vibe\/sessions\/([A-Za-z0-9_-]+)$/.exec(path);
      if (session && req.method === "GET") return json(res, 200, { ok: true, session: await client.sessions.get(session[1]) });
      if (session && req.method === "PATCH") {
        const body = await readVibeJson(req);
        const title = String(body.title || "").trim().slice(0, 160);
        if (!title) throw new VibeError("Titre requis", 400, "invalid_title");
        return json(res, 200, { ok: true, result: await client.sessions.update(session[1], { title }) });
      }
      if (session && req.method === "DELETE") return json(res, 200, { ok: true, result: await client.sessions.remove(session[1]) });
      return json(res, 404, { error: "Route Vibe inconnue", code: "not_found" });
    } catch (error) {
      const status = error instanceof VibeError ? error.status : 502;
      const code = error instanceof VibeError ? error.code : "vibe_proxy_failed";
      return json(res, status, { error: safeMessage(error?.message), code });
    }
  };
}
