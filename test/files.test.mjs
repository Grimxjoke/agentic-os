import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../server/database.mjs";
import { createFileService } from "../server/files.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "orbit-files-test-"));
  const workspace = join(directory, "workspace");
  const dataDirectory = join(directory, "data");
  await mkdir(join(workspace, "research"), { recursive: true });
  const opened = await openDatabase({ dataDirectory });
  const store = new ControlPlaneStore(opened.db, () => "2026-07-17T15:00:00.000Z");
  const files = createFileService({ roots: [{ id: "workspace", label: "Workspace", path: workspace, writable: true }], dataDirectory, store });
  return { directory, workspace, ...opened, store, files };
}

async function cleanup(opened) {
  opened.db.close();
  await rm(opened.directory, { recursive: true, force: true });
}

test("filesystem boundaries reject traversal, symlinks, denied extensions and oversized writes", async () => {
  const opened = await fixture();
  try {
    await writeFile(join(opened.workspace, "research", "note.md"), "safe");
    await symlink("/etc/passwd", join(opened.workspace, "research", "escape.md"));
    await assert.rejects(() => opened.files.read("workspace", "../outside.md"), (error) => error.code === "file_boundary");
    await assert.rejects(() => opened.files.read("workspace", "research/escape.md"), (error) => error.code === "symlink_denied");
    await assert.rejects(() => opened.files.write("workspace", "research/script.sh", "echo unsafe"), (error) => error.code === "extension_denied");
    await assert.rejects(() => opened.files.write("workspace", "research/large.md", "x".repeat(524_289)), (error) => error.code === "file_too_large");
    const listing = await opened.files.list("workspace", "research");
    assert.deepEqual(listing.entries.map((entry) => entry.name), ["note.md"]);
  } finally { await cleanup(opened); }
});
test("writes are atomic, conflict-aware and restore exact backups", async () => {
  const opened = await fixture();
  try {
    const path = "research/hypothesis.md";
    await writeFile(join(opened.workspace, path), "first version\n");
    const original = await opened.files.read("workspace", path);
    const saved = await opened.files.write("workspace", path, "second version\n", original.checksum);
    assert.equal(saved.content, "second version\n");
    assert.ok(saved.backup.id);
    await assert.rejects(() => opened.files.write("workspace", path, "stale edit", original.checksum), (error) => error.code === "edit_conflict");
    const restored = await opened.files.restore(saved.backup.id);
    assert.equal(restored.content, "first version\n");
    assert.equal(await readFile(join(opened.workspace, path), "utf8"), "first version\n");
    assert.equal(opened.store.listFileBackups("workspace", path).length, 2);
  } finally { await cleanup(opened); }
});

test("binary files remain visible as metadata but cannot be opened", async () => {
  const opened = await fixture();
  try {
    await writeFile(join(opened.workspace, "research", "sample.bin"), Buffer.from([0, 255, 1, 2]));
    const listing = await opened.files.list("workspace", "research");
    assert.equal(listing.entries[0].text, false);
    assert.equal(listing.entries[0].bytes, 4);
    await assert.rejects(() => opened.files.read("workspace", "research/sample.bin"), (error) => error.code === "binary_file");
  } finally { await cleanup(opened); }
});

test("artifact refresh reflects additions and deletions and search finds content", async () => {
  const opened = await fixture();
  try {
    await writeFile(join(opened.workspace, "research", "alpha.md"), "A volatility breakout hypothesis");
    let entries = await opened.files.walk("workspace");
    opened.store.replaceFileArtifactIndex(entries.filter((entry) => entry.text));
    assert.equal(opened.store.listArtifacts({ query: "alpha" }).length, 1);
    assert.equal((await opened.files.search("volatility"))[0].path, "research/alpha.md");
    await rm(join(opened.workspace, "research", "alpha.md"));
    entries = await opened.files.walk("workspace");
    opened.store.replaceFileArtifactIndex(entries.filter((entry) => entry.text));
    assert.equal(opened.store.listArtifacts({ query: "alpha" }).length, 0);
  } finally { await cleanup(opened); }
});
