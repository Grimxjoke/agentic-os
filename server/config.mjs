import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadConfig(overrides = {}) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const config = {
    root,
    workspace: resolve(process.env.ORBIT_WORKSPACE || root),
    dataDirectory: resolve(process.env.ORBIT_DATA_DIR || `${root}/.orbit-data`),
    port: Number(process.env.PORT || 4173),
    host: process.env.HOST || "127.0.0.1",
    isDev: process.argv.includes("--dev"),
    authMode: process.env.ORBIT_AUTH_MODE || "token",
    accessToken: process.env.ORBIT_ACCESS_TOKEN || randomBytes(32).toString("base64url"),
    googleClientId: process.env.ORBIT_GOOGLE_CLIENT_ID || "",
    googleAllowedEmail: (process.env.ORBIT_GOOGLE_ALLOWED_EMAIL || "").trim().toLowerCase(),
    vibeBaseUrl: process.env.VIBE_BASE_URL || "http://127.0.0.1:8899",
    vibeApiKey: process.env.VIBE_API_KEY || "",
    basePath: "/orbit",
    ...overrides,
  };
  config.fileRoots = config.fileRoots || [
    { id: "workspace", label: "Orbit workspace", path: config.workspace, writable: true },
  ];
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new Error(`Invalid PORT: ${config.port}`);
  }
  if (!["token", "google", "ngrok_google"].includes(config.authMode)) throw new Error("Invalid ORBIT_AUTH_MODE");
  if (config.authMode === "google" && (!config.googleClientId || !config.googleAllowedEmail)) {
    throw new Error("google authentication requires ORBIT_GOOGLE_CLIENT_ID and ORBIT_GOOGLE_ALLOWED_EMAIL");
  }
  if (config.authMode === "ngrok_google" && !["127.0.0.1", "::1", "localhost"].includes(config.host)) {
    throw new Error("ngrok_google authentication requires a loopback-only Orbit host");
  }
  return config;
}
