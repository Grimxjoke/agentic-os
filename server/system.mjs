import { access } from "node:fs/promises";
import { createConnection } from "node:net";
import process from "node:process";
import { backupDatabase, databaseSize, schemaVersion } from "./database.mjs";

async function executableAvailable(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function tcpAvailable(port, host = "127.0.0.1", timeout = 250) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const done = (available) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export function createSystemService({ db, databasePath, dataDirectory, store, version, vibeClient }) {
  async function overview() {
    const [piAvailable, codexAvailable, vibeState, bytes] = await Promise.all([
      executableAvailable("/usr/local/bin/pi"),
      executableAvailable("/usr/local/bin/codex"),
      vibeClient
        ? vibeClient.overview().catch(() => ({ engine: "offline", ready: false, reason: "Local API unavailable" }))
        : tcpAvailable(8899).then((available) => ({ engine: available ? "online" : "offline", ready: available })),
      databaseSize(databasePath),
    ]);
    const memory = process.memoryUsage();
    return {
      generatedAt: new Date().toISOString(),
      version,
      runtime: {
        node: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryBytes: memory.rss,
      },
      database: {
        status: "operational",
        engine: "SQLite WAL",
        schemaVersion: schemaVersion(db),
        bytes,
      },
      counts: store.counts(),
      services: [
        { id: "orbit", name: "Orbit API", status: "operational", detail: "Control-plane local" },
        { id: "database", name: "SQLite", status: "operational", detail: `Diagram v${schemaVersion(db)}` },
        { id: "pi", name: "PI Runtime", status: piAvailable ? "available" : "unavailable", detail: piAvailable ? "CLI detected · read-only" : "CLI not found" },
        { id: "codex", name: "Codex Bridge", status: codexAvailable ? "available" : "unavailable", detail: codexAvailable ? "CLI detected · systemd sandbox" : "CLI not found" },
        {
          id: "vibe",
          name: "Vibe-Trading",
          status: vibeState.engine === "online" ? (vibeState.ready ? "operational" : "degraded") : "unavailable",
          detail: vibeState.engine === "online" ? (vibeState.ready ? "Engine and provider ready" : vibeState.reason || "Provider not ready") : "Local API unavailable",
        },
      ],
      activity: store.recentActivity(12),
    };
  }

  async function createBackup() {
    const result = await backupDatabase(db, dataDirectory);
    store.event({ type: "database.backup", message: `Backup ${result.filename} created`, payload: { filename: result.filename, bytes: result.bytes } });
    store.audit({ actor: "user", action: "database.backup", outcome: "success", targetType: "backup", targetId: result.filename, metadata: { bytes: result.bytes } });
    return result;
  }

  return { overview, createBackup };
}
