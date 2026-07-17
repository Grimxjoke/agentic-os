import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql",
  ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const BLOCKED_SEGMENTS = new Set([".git", ".orbit-data", "dist", "node_modules"]);
const READ_LIMIT = 1_048_576;
const WRITE_LIMIT = 524_288;

export class FileBoundaryError extends Error {
  constructor(message, code = "file_boundary") {
    super(message);
    this.name = "FileBoundaryError";
    this.code = code;
  }
}

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeRelative(value = "") {
  const candidate = String(value).replaceAll("\\", "/").replace(/^\.\//, "");
  if (isAbsolute(candidate) || candidate.includes("\0")) throw new FileBoundaryError("Absolute or invalid paths are not allowed");
  const parts = candidate.split("/").filter(Boolean);
  if (parts.some((part) => part === ".." || part === "." || BLOCKED_SEGMENTS.has(part))) {
    throw new FileBoundaryError("The requested path is outside the allowlist");
  }
  return parts.join("/");
}

function inside(root, target) {
  const delta = relative(root, target);
  return delta === "" || (!delta.startsWith(`..${sep}`) && delta !== ".." && !isAbsolute(delta));
}

function isText(path) {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

function mimeType(path) {
  const extension = extname(path).toLowerCase();
  return ({
    ".css": "text/css", ".csv": "text/csv", ".html": "text/html", ".js": "text/javascript",
    ".json": "application/json", ".jsx": "text/javascript", ".md": "text/markdown", ".mjs": "text/javascript",
    ".sql": "application/sql", ".toml": "application/toml", ".ts": "text/typescript", ".tsx": "text/typescript",
    ".txt": "text/plain", ".yaml": "application/yaml", ".yml": "application/yaml",
  })[extension] || "application/octet-stream";
}

export function createFileService({ roots, dataDirectory, store }) {
  const rootMap = new Map((roots || []).map((root) => [root.id, { ...root, path: resolve(root.path) }]));
  const backupsDirectory = join(dataDirectory, "file-backups");

  function getRoot(rootId) {
    const root = rootMap.get(String(rootId || "workspace"));
    if (!root) throw new FileBoundaryError("Unknown filesystem root", "unknown_root");
    return root;
  }

  async function targetFor(rootId, path, { mustExist = true } = {}) {
    const root = getRoot(rootId);
    const cleanPath = normalizeRelative(path);
    const target = resolve(root.path, cleanPath);
    if (!inside(root.path, target)) throw new FileBoundaryError("The requested path is outside the allowlist");
    let current = root.path;
    for (const segment of cleanPath.split("/").filter(Boolean)) {
      current = join(current, segment);
      try {
        const details = await lstat(current);
        if (details.isSymbolicLink()) throw new FileBoundaryError("Symbolic links are not allowed", "symlink_denied");
      } catch (error) {
        if (error instanceof FileBoundaryError) throw error;
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
    if (mustExist) {
      const canonicalRoot = await realpath(root.path);
      const canonicalTarget = await realpath(target);
      if (!inside(canonicalRoot, canonicalTarget)) throw new FileBoundaryError("Resolved path leaves the allowlist");
    }
    return { root, cleanPath, target };
  }

  async function list(rootId = "workspace", path = "") {
    const { root, cleanPath, target } = await targetFor(rootId, path);
    const details = await stat(target);
    if (!details.isDirectory()) throw new FileBoundaryError("Path is not a directory", "not_directory");
    const entries = [];
    for (const entry of await readdir(target, { withFileTypes: true })) {
      if (BLOCKED_SEGMENTS.has(entry.name) || entry.isSymbolicLink()) continue;
      const childPath = cleanPath ? `${cleanPath}/${entry.name}` : entry.name;
      const childStat = await stat(join(target, entry.name));
      entries.push({
        name: entry.name,
        path: childPath,
        type: entry.isDirectory() ? "directory" : "file",
        text: entry.isFile() && isText(entry.name),
        bytes: entry.isFile() ? childStat.size : null,
        updatedAt: childStat.mtime.toISOString(),
      });
    }
    entries.sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name) : left.type === "directory" ? -1 : 1);
    return { root: { id: root.id, label: root.label, writable: root.writable }, path: cleanPath, entries };
  }

  async function read(rootId, path) {
    const { root, cleanPath, target } = await targetFor(rootId, path);
    const details = await stat(target);
    if (!details.isFile()) throw new FileBoundaryError("Path is not a file", "not_file");
    if (!isText(cleanPath)) throw new FileBoundaryError("Binary files cannot be opened in the editor", "binary_file");
    if (details.size > READ_LIMIT) throw new FileBoundaryError("File exceeds the 1 MiB read limit", "file_too_large");
    const content = await readFile(target, "utf8");
    return { rootId: root.id, path: cleanPath, name: basename(cleanPath), content, bytes: details.size, checksum: checksum(content), mimeType: mimeType(cleanPath), updatedAt: details.mtime.toISOString(), writable: root.writable };
  }

  async function backup(root, cleanPath, target, actor) {
    const content = await readFile(target);
    const id = randomUUID();
    const destinationDirectory = join(backupsDirectory, root.id);
    await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
    const destination = join(destinationDirectory, `${id}.bak`);
    await writeFile(destination, content, { mode: 0o600 });
    return store.createFileBackup({ id, rootId: root.id, relativePath: cleanPath, backupPath: destination, checksum: checksum(content), bytes: content.length, actor });
  }

  async function write(rootId, path, content, expectedChecksum, actor = "user") {
    const { root, cleanPath, target } = await targetFor(rootId, path, { mustExist: false });
    if (!root.writable) throw new FileBoundaryError("This root is read-only", "read_only_root");
    if (!isText(cleanPath)) throw new FileBoundaryError("This file extension is not editable", "extension_denied");
    const payload = Buffer.from(String(content), "utf8");
    if (payload.length > WRITE_LIMIT) throw new FileBoundaryError("File exceeds the 512 KiB write limit", "file_too_large");
    await mkdir(dirname(target), { recursive: true });
    let previous = null;
    try {
      const current = await readFile(target);
      const currentChecksum = checksum(current);
      if (expectedChecksum && expectedChecksum !== currentChecksum) throw new FileBoundaryError("File changed since it was opened", "edit_conflict");
      previous = await backup(root, cleanPath, target, actor);
    } catch (error) {
      if (error instanceof FileBoundaryError) throw error;
      if (error.code !== "ENOENT") throw error;
    }
    const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(payload);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
    const directoryHandle = await open(dirname(target), "r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    store.audit({ actor, action: "file.written", outcome: "success", targetType: "file", targetId: `${root.id}:${cleanPath}`, metadata: { backupId: previous?.id || null, bytes: payload.length } });
    store.event({ type: "file.written", message: `${cleanPath} saved`, payload: { rootId: root.id, path: cleanPath, backupId: previous?.id || null } });
    return { ...(await read(root.id, cleanPath)), backup: previous };
  }

  async function restore(backupId, actor = "user") {
    const record = store.getFileBackup(backupId);
    if (!record) throw new FileBoundaryError("Backup not found", "backup_not_found");
    const content = await readFile(record.backupPath, "utf8");
    const current = await read(record.rootId, record.relativePath);
    const restored = await write(record.rootId, record.relativePath, content, current.checksum, actor);
    store.audit({ actor, action: "file.restored", outcome: "success", targetType: "file_backup", targetId: backupId, metadata: { rootId: record.rootId, path: record.relativePath } });
    return restored;
  }

  async function walk(rootId, path = "", results = [], limit = 5_000) {
    if (results.length >= limit) return results;
    const listing = await list(rootId, path);
    for (const entry of listing.entries) {
      if (results.length >= limit) break;
      if (entry.type === "directory") await walk(rootId, entry.path, results, limit);
      else results.push({ rootId, ...entry, mimeType: mimeType(entry.path) });
    }
    return results;
  }

  async function search(query, rootId = "workspace") {
    const needle = String(query || "").trim().toLowerCase();
    if (needle.length < 2) return [];
    const matches = [];
    for (const entry of await walk(rootId)) {
      if (!entry.text || entry.bytes > READ_LIMIT) continue;
      let content = "";
      if (!entry.name.toLowerCase().includes(needle)) content = (await read(rootId, entry.path)).content;
      if (entry.name.toLowerCase().includes(needle) || content.toLowerCase().includes(needle)) matches.push(entry);
      if (matches.length >= 100) break;
    }
    return matches;
  }

  async function removeTemporary(path) {
    try { await unlink(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }

  return { roots: () => [...rootMap.values()].map(({ id, label, writable }) => ({ id, label, writable })), list, read, write, restore, search, walk, removeTemporary };
}
