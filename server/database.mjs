import { chmod, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync, backup as sqliteBackup } from "node:sqlite";

const migrationsDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));

function migrationVersion(filename) {
  const match = /^(\d+)_.*\.sql$/.exec(filename);
  return match ? Number(match[1]) : 0;
}

export async function openDatabase({ dataDirectory, databasePath } = {}) {
  const directory = resolve(dataDirectory || process.env.ORBIT_DATA_DIR || ".orbit-data");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const path = resolve(databasePath || join(directory, "orbit.sqlite"));
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT;");
  await runMigrations(db);
  return { db, directory, path };
}

export async function runMigrations(db) {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => migrationVersion(name) > 0)
    .sort((left, right) => migrationVersion(left) - migrationVersion(right));
  const applied = db.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version);
  const appliedSet = new Set(applied);
  for (const filename of files) {
    const version = migrationVersion(filename);
    if (appliedSet.has(version)) continue;
    const sql = await readFile(join(migrationsDirectory, filename), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)")
        .run(version, filename, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${filename} impossible`, { cause: error });
    }
  }
}

export function schemaVersion(db) {
  return Number(db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get().version);
}

export async function databaseSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

export async function backupDatabase(db, directory) {
  const backupsDirectory = join(directory, "backups");
  await mkdir(backupsDirectory, { recursive: true, mode: 0o700 });
  await chmod(backupsDirectory, 0o700);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `orbit-${stamp}.sqlite`;
  const destination = join(backupsDirectory, filename);
  await sqliteBackup(db, destination);
  await chmod(destination, 0o600);
  return { filename, bytes: (await stat(destination)).size, createdAt: new Date().toISOString() };
}
