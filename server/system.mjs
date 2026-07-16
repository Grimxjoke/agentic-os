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

export function createSystemService({ db, databasePath, dataDirectory, store, version }) {
  async function overview() {
    const [piAvailable, codexAvailable, vibeAvailable, bytes] = await Promise.all([
      executableAvailable("/usr/local/bin/pi"),
      executableAvailable("/usr/local/bin/codex"),
      tcpAvailable(8899),
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
        { id: "database", name: "SQLite", status: "operational", detail: `Schéma v${schemaVersion(db)}` },
        { id: "pi", name: "PI Runtime", status: piAvailable ? "available" : "unavailable", detail: piAvailable ? "CLI détecté · lecture seule" : "CLI introuvable" },
        { id: "codex", name: "Codex Bridge", status: codexAvailable ? "available" : "unavailable", detail: codexAvailable ? "CLI détecté · sandbox systemd" : "CLI introuvable" },
        { id: "vibe", name: "Vibe-Trading", status: vibeAvailable ? "available" : "deferred", detail: vibeAvailable ? "API locale détectée" : "Phase ultérieure · port fermé" },
      ],
      activity: store.recentActivity(12),
    };
  }

  async function createBackup() {
    const result = await backupDatabase(db, dataDirectory);
    store.event({ type: "database.backup", message: `Sauvegarde ${result.filename} créée`, payload: { filename: result.filename, bytes: result.bytes } });
    store.audit({ actor: "user", action: "database.backup", outcome: "success", targetType: "backup", targetId: result.filename, metadata: { bytes: result.bytes } });
    return result;
  }

  return { overview, createBackup };
}
