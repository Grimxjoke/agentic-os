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
    accessToken: process.env.ORBIT_ACCESS_TOKEN || randomBytes(32).toString("base64url"),
    vibeBaseUrl: process.env.VIBE_BASE_URL || "http://127.0.0.1:8899",
    vibeApiKey: process.env.VIBE_API_KEY || "",
    basePath: "/orbit",
    ...overrides,
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new Error(`Invalid PORT: ${config.port}`);
  }
  return config;
}
