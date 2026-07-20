import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

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

export function securityHeaders(extra = {}) {
  return {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extra,
  };
}

export function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, securityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  }));
  res.end(body);
}

export function unauthorized(res, pathname) {
  const safePath = String(pathname || "/orbit/").replace(/["<>]/g, "");
  const body = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Orbit OS</title><style>body{font:16px system-ui;background:#0d1117;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0}main{width:min(480px,calc(100% - 64px));padding:32px;border:1px solid #30363d;border-radius:14px;background:#161b22}form{display:flex;gap:8px;margin-top:22px}input{min-width:0;flex:1;padding:12px;color:#e6edf3;background:#0d1117;border:1px solid #30363d;border-radius:8px}button{padding:12px 18px;color:#081018;background:#7ee787;border:0;border-radius:8px;font-weight:700}</style><main><h1>Protected Access</h1><p>Enter your Orbit OS token. Orbit will create a revocable session for this device.</p><form method=get action="${safePath}"><input type=password name=access autocomplete=current-password required autofocus placeholder="Access token"><button>Open</button></form></main>`;
  res.writeHead(401, securityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  }));
  res.end(body);
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

export function googleLogin(res, { clientId, next = "/orbit/" }) {
  const safeNext = String(next).startsWith("/orbit/") ? String(next) : "/orbit/";
  const serializedNext = JSON.stringify(safeNext).replace(/</g, "\\u003c");
  const body = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Connexion · Orbit OS</title><style>body{font:16px system-ui;background:#0d1117;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0}main{width:min(430px,calc(100% - 64px));padding:36px;border:1px solid #30363d;border-radius:16px;background:#161b22;text-align:center}p{color:#9da7b3;line-height:1.5}.button{display:flex;justify-content:center;margin-top:28px}.error{color:#ff9b9b;min-height:24px;margin-top:18px}</style><script src="https://accounts.google.com/gsi/client" async></script></head><body><main><h1>Orbit OS</h1><p>Connectez-vous avec le compte Google autorisé pour ouvrir votre espace privé.</p><div id="g_id_onload" data-client_id="${htmlEscape(clientId)}" data-callback="orbitGoogleLogin" data-auto_prompt="false"></div><div class="button"><div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_blue" data-text="signin_with" data-size="large"></div></div><p id="error" class="error" role="alert"></p></main><script>const orbitNext=${serializedNext};async function orbitGoogleLogin(response){const error=document.getElementById("error");error.textContent="Connexion en cours…";try{const result=await fetch("/orbit/auth/google",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:response.credential})});if(!result.ok)throw new Error("Compte non autorisé ou connexion expirée.");location.assign(orbitNext)}catch(reason){error.textContent=reason.message||"Connexion impossible."}}</script></body></html>`;
  res.writeHead(200, securityHeaders({
    "Cache-Control": "no-store",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  }));
  res.end(body);
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export async function readJson(req, limit = 24 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Query too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [cookieName, ...value] = cookie.trim().split("=");
    if (cookieName === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export async function serveStatic(req, res, url, { root, basePath }) {
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
    json(res, 503, { error: "Build missing. Run npm run build." });
  }
}

export function sessionCookie(name, token, secure, maxAge = 2_592_000) {
  return `${name}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
