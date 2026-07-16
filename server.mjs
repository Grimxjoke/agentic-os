import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const workspace = resolve(process.env.ORBIT_WORKSPACE || root);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const isDev = process.argv.includes("--dev");
const accessToken = process.env.ORBIT_ACCESS_TOKEN || randomBytes(32).toString("base64url");
const cookieName = "orbit_access";
const basePath = "/orbit";
const activeAgents = new Set();

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`PORT invalide: ${process.env.PORT || ""}`);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function tokenMatches(candidate = "") {
  const expected = Buffer.from(accessToken);
  const actual = Buffer.from(candidate);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cookieValue(req) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === cookieName) return decodeURIComponent(value.join("="));
  }
  return "";
}

function securityHeaders(extra = {}) {
  return {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extra,
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, securityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  }));
  res.end(body);
}

function unauthorized(res, pathname = `${basePath}/`) {
  const body = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Orbit OS</title><style>body{font:16px system-ui;background:#0d1117;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0}main{width:min(480px,calc(100% - 64px));padding:32px;border:1px solid #30363d;border-radius:14px;background:#161b22}form{display:flex;gap:8px;margin-top:22px}input{min-width:0;flex:1;padding:12px;color:#e6edf3;background:#0d1117;border:1px solid #30363d;border-radius:8px}button{padding:12px 18px;color:#081018;background:#7ee787;border:0;border-radius:8px;font-weight:700}</style><main><h1>Accès protégé</h1><p>Saisissez votre jeton Orbit OS. Une fois validé, cet appareil restera connecté pendant 30 jours.</p><form method=get action="${pathname}"><input type=password name=access autocomplete=current-password required autofocus placeholder="Jeton d’accès"><button>Ouvrir</button></form></main>`;
  res.writeHead(401, securityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  }));
  res.end(body);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function readJson(req, limit = 24 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Requête trop volumineuse");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("Corps JSON invalide");
  }
}

function run(command, args, timeoutMs = 10 * 60 * 1000, input = "") {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: workspace,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputSize = 0;
    const maxOutput = 2 * 1024 * 1024;
    const collect = (target) => (chunk) => {
      outputSize += chunk.length;
      if (outputSize > maxOutput) {
        child.kill("SIGTERM");
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
    child.on("error", rejectRun);
    const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const result = {
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (outputSize > maxOutput) rejectRun(new Error("La réponse de l’agent dépasse la limite autorisée"));
      else resolveRun(result);
    });
  });
}

function parseCodexOutput(output) {
  let reply = "";
  let sessionId = "";
  for (const line of output.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") sessionId = String(event.thread_id || "");
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        reply = String(event.item.text || "");
      }
    } catch {
      // Ignore non-event output emitted by the CLI.
    }
  }
  return { reply: reply.trim(), sessionId };
}

async function chatWithPi({ message, mode, sessionId }) {
  const safeSessionId = /^[0-9a-f-]{36}$/i.test(sessionId || "") ? sessionId : randomUUID();
  const systemPrompt = mode === "build"
    ? "Tu es PI, orchestrateur du VPS. Cette passerelle est volontairement en lecture seule : inspecte et propose, puis indique clairement les modifications à déléguer à Codex."
    : "Tu es PI, orchestrateur du VPS. Travaille en lecture seule, observe l’état réel et réponds de façon concise et vérifiable.";
  const result = await run("sudo", [
    "-n", "pi", "--print", "--approve", "--session-id", safeSessionId,
    "--tools", "read,grep,find,ls", "--append-system-prompt", systemPrompt,
  ], 10 * 60 * 1000, `[Mode ${mode}] ${message}\n`);
  if (result.code !== 0) throw new Error(result.stderr.trim() || `PI s’est arrêté avec le code ${result.code}`);
  return { reply: result.stdout.trim(), sessionId: safeSessionId, safety: "read-only" };
}

async function chatWithCodex({ message, mode, sessionId }) {
  const sandbox = mode === "build" ? "systemd-workspace-write" : "systemd-read-only";
  const prompt = `[Mode ${mode}] ${message}`;
  const writablePaths = mode === "build"
    ? `${workspace} /home/codex/.codex`
    : "/home/codex/.codex";
  const isolationArgs = [
    "-n", "systemd-run", "--pipe", "--wait", "--quiet", "--collect",
    "-p", "User=codex", "-p", "Group=codex", `-p`, `WorkingDirectory=${workspace}`,
    "-p", "NoNewPrivileges=yes", "-p", "PrivateTmp=yes", "-p", "PrivateDevices=yes",
    "-p", "ProtectSystem=strict", "-p", "ProtectHome=read-only",
    "-p", "ProtectKernelTunables=yes", "-p", "ProtectKernelModules=yes",
    "-p", "ProtectControlGroups=yes", "-p", "RestrictSUIDSGID=yes", "-p", "LockPersonality=yes",
    "-p", `ReadWritePaths=${writablePaths}`,
    "-p", "BindReadOnlyPaths=/home/codex/.codex/auth.json /home/codex/.codex/config.toml /home/codex/.codex/plugins /home/codex/.codex/skills /home/codex/.codex/attachments /home/codex/.codex/visualizations",
  ];
  // Codex's own bubblewrap sandbox cannot create namespaces on this VPS. The
  // transient systemd unit above is the outer sandbox; Codex therefore runs in
  // danger-full-access only inside that constrained unit.
  const globalArgs = ["codex", "-a", "never", "--sandbox", "danger-full-access", "exec"];
  const requestedSessionId = /^[0-9a-f-]{36}$/i.test(sessionId || "") ? sessionId : "";
  const argsFor = (resumeId = "") => resumeId
    ? [...isolationArgs, ...globalArgs, "resume", "--json", resumeId, "-"]
    : [...isolationArgs, ...globalArgs, "--json", "--color", "never", "-C", workspace, "-"];
  let result = await run("sudo", argsFor(requestedSessionId), 10 * 60 * 1000, `${prompt}\n`);
  let sessionReset = false;
  const resumeError = `${result.stderr}\n${result.stdout}`;
  if (requestedSessionId && result.code !== 0 && /no rollout found for thread id/i.test(resumeError)) {
    result = await run("sudo", argsFor(), 10 * 60 * 1000, `${prompt}\n`);
    sessionReset = true;
  }
  const parsed = parseCodexOutput(result.stdout);
  if (result.code !== 0 || !parsed.reply) {
    const detail = result.stderr.trim() || result.stdout.trim() || `Codex s’est arrêté avec le code ${result.code}`;
    throw new Error(detail.slice(-1200));
  }
  return { reply: parsed.reply, sessionId: parsed.sessionId || requestedSessionId, sessionReset, safety: sandbox };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, workspace, agents: { pi: "read-only", codex: "sandboxed" } });
  }
  if (req.method !== "POST" || url.pathname !== "/api/chat") return json(res, 404, { error: "Route inconnue" });
  if (!sameOrigin(req)) return json(res, 403, { error: "Origine refusée" });

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
  const agent = body.agent === "pi" || body.agent === "codex" ? body.agent : "";
  const mode = body.mode === "build" ? "build" : "plan";
  const message = String(body.message || "").trim();
  if (!agent) return json(res, 400, { error: "Agent invalide" });
  if (!message) return json(res, 400, { error: "Message vide" });
  if (message.length > 16_000) return json(res, 400, { error: "Message trop long (16 000 caractères maximum)" });
  if (activeAgents.has(agent)) return json(res, 409, { error: `${agent === "pi" ? "PI" : "Codex"} traite déjà une demande` });

  activeAgents.add(agent);
  try {
    const result = agent === "pi"
      ? await chatWithPi({ message, mode, sessionId: body.sessionId })
      : await chatWithCodex({ message, mode, sessionId: body.sessionId });
    return json(res, 200, { ok: true, ...result });
  } catch (error) {
    return json(res, 502, { ok: false, error: String(error?.message || error).slice(-1400) });
  } finally {
    activeAgents.delete(agent);
  }
}

async function serveStatic(req, res, url) {
  const dist = join(root, "dist");
  const pathname = url.pathname === basePath ? "/" : url.pathname.startsWith(`${basePath}/`) ? url.pathname.slice(basePath.length) : url.pathname;
  let relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  relative = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = join(dist, relative);
  try {
    if (!(await stat(file)).isFile()) file = join(dist, "index.html");
  } catch {
    file = join(dist, "index.html");
  }
  try {
    await access(file);
    const info = await stat(file);
    res.writeHead(200, securityHeaders({
      "Content-Type": mimeTypes[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    }));
    createReadStream(file).pipe(res);
  } catch {
    json(res, 503, { error: "Build absent. Lancez npm run build." });
  }
}

let vite;
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    appType: "spa",
    server: { middlewareMode: true, allowedHosts: true },
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const isLiveness = url.pathname === "/healthz" || url.pathname === `${basePath}/healthz`;
    const isReadiness = url.pathname === "/readyz" || url.pathname === `${basePath}/readyz`;
    if (req.method === "GET" && isLiveness) return json(res, 200, { ok: true, status: "alive" });
    if (req.method === "GET" && isReadiness) {
      try {
        await access(join(root, "dist", "index.html"));
        return json(res, 200, { ok: true, status: "ready" });
      } catch {
        return json(res, 503, { ok: false, status: "not_ready" });
      }
    }

    const queryToken = url.searchParams.get("access") || "";
    if (queryToken && tokenMatches(queryToken)) {
      const secure = req.headers["x-forwarded-proto"] === "https";
      url.searchParams.delete("access");
      res.writeHead(302, securityHeaders({
        Location: `${url.pathname}${url.search}`,
        "Cache-Control": "no-store",
        "Set-Cookie": `${cookieName}=${encodeURIComponent(accessToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure ? "; Secure" : ""}`,
      }));
      return res.end();
    }
    if (!tokenMatches(cookieValue(req))) return unauthorized(res, url.pathname);
    if (url.pathname === "/" || url.pathname === basePath) {
      res.writeHead(302, securityHeaders({ Location: `${basePath}/`, "Cache-Control": "no-store" }));
      return res.end();
    }
    const routedPath = url.pathname.startsWith(`${basePath}/`) ? url.pathname.slice(basePath.length) : url.pathname;
    if (routedPath.startsWith("/api/")) {
      const routedUrl = new URL(url);
      routedUrl.pathname = routedPath;
      return await handleApi(req, res, routedUrl);
    }
    if (vite) return vite.middlewares(req, res, () => json(res, 404, { error: "Introuvable" }));
    return await serveStatic(req, res, url);
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

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}

server.listen(port, host, () => {
  console.log(`Orbit OS ${isDev ? "dev" : "production"} listening on http://${host}:${port}`);
  console.log(`Protected application path: ${basePath}/`);
  console.log(`Workspace: ${workspace}`);
});
