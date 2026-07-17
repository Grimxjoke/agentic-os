import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, File, FileText, FolderOpen, History, Plus, RefreshCw, RotateCcw, Save, Search, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { FileBackup, FileEntry, FileRoot, WorkspaceDocument } from "../types";

const formatBytes = (bytes: number | null) => bytes === null ? "—" : bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;

export function FilesPage() {
  const [params, setParams] = useSearchParams();
  const [roots, setRoots] = useState<FileRoot[]>([]);
  const [rootId, setRootId] = useState("workspace");
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [document, setDocument] = useState<WorkspaceDocument | null>(null);
  const [draft, setDraft] = useState("");
  const [backups, setBackups] = useState<FileBackup[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadDirectory = useCallback(async (nextPath = path) => {
    setError("");
    try {
      const response = await api<{ entries: FileEntry[] }>(`/files?root=${encodeURIComponent(rootId)}&path=${encodeURIComponent(nextPath)}`);
      setEntries(response.entries); setPath(nextPath); setDocument(null); setBackups([]); setSearchResults(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to open directory"); }
  }, [path, rootId]);

  const openFile = useCallback(async (entryPath: string) => {
    setError("");
    try {
      const response = await api<{ file: WorkspaceDocument }>(`/files/content?root=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entryPath)}`);
      setDocument(response.file); setDraft(response.file.content); setParams({ path: entryPath });
      const history = await api<{ backups: FileBackup[] }>(`/files/backups?root=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entryPath)}`);
      setBackups(history.backups);
    } catch (reason) {
      const message = reason instanceof ApiError && reason.code === "binary_file" ? "Binary files are metadata-only and cannot be opened in the editor." : reason instanceof Error ? reason.message : "Unable to open file";
      setError(message);
    }
  }, [rootId, setParams]);

  useEffect(() => {
    api<{ roots: FileRoot[] }>("/files/roots").then((response) => setRoots(response.roots)).catch((reason) => setError(reason.message));
    const requested = params.get("path");
    if (requested) {
      const directory = requested.split("/").slice(0, -1).join("/");
      setPath(directory); loadDirectory(directory).then(() => openFile(requested));
    } else loadDirectory("");
    // Initial deep-link hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!document) return;
    setBusy(true); setError("");
    try {
      const response = await api<{ file: WorkspaceDocument & { backup?: FileBackup } }>("/files/content", {
        method: "PUT", body: JSON.stringify({ rootId, path: document.path, content: draft, expectedChecksum: document.checksum }),
      });
      setDocument(response.file); setDraft(response.file.content);
      const history = await api<{ backups: FileBackup[] }>(`/files/backups?root=${encodeURIComponent(rootId)}&path=${encodeURIComponent(document.path)}`);
      setBackups(history.backups); await loadDirectory(path); await openFile(document.path);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save file"); }
    finally { setBusy(false); }
  };

  const restore = async (backup: FileBackup) => {
    if (!window.confirm(`Restore the backup from ${new Date(backup.createdAt).toLocaleString()}? The current version will also be backed up.`)) return;
    setBusy(true);
    try {
      const response = await api<{ file: WorkspaceDocument }>(`/files/backups/${backup.id}/restore`, { method: "POST" });
      setDocument(response.file); setDraft(response.file.content); await openFile(response.file.path);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to restore backup"); }
    finally { setBusy(false); }
  };

  const createFile = async () => {
    const name = window.prompt("New text file name (for example: hypothesis.md)");
    if (!name) return;
    const nextPath = [path, name.trim()].filter(Boolean).join("/");
    setBusy(true);
    try {
      const response = await api<{ file: WorkspaceDocument }>("/files/content", { method: "PUT", body: JSON.stringify({ rootId, path: nextPath, content: `# ${name.replace(/\.[^.]+$/, "")}\n` }) });
      await loadDirectory(path); setDocument(response.file); setDraft(response.file.content); setParams({ path: nextPath });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create file"); }
    finally { setBusy(false); }
  };

  const search = async () => {
    if (query.trim().length < 2) { setSearchResults(null); return; }
    setBusy(true);
    try {
      const response = await api<{ results: FileEntry[] }>(`/files/search?root=${encodeURIComponent(rootId)}&q=${encodeURIComponent(query)}`);
      setSearchResults(response.results);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Search failed"); }
    finally { setBusy(false); }
  };

  const visibleEntries = searchResults ?? entries;
  const parent = useMemo(() => path.split("/").slice(0, -1).join("/"), [path]);

  return <div className="ide-shell phase4-files">
    <aside className="file-sidebar">
      <header><span>ALLOWLISTED FILES</span><div><button onClick={createFile} aria-label="New file"><Plus size={15} /></button><button onClick={() => loadDirectory(path)} aria-label="Refresh"><RefreshCw size={14} /></button></div></header>
      <div className="workspace-root"><ShieldCheck size={14} /><select value={rootId} onChange={(event) => { setRootId(event.target.value); setPath(""); }}>{roots.map((root) => <option key={root.id} value={root.id}>{root.label}</option>)}</select><em>BOUNDED</em></div>
      <div className="file-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Search names and content" /></div>
      <div className="file-tree real-tree">
        {path && !searchResults && <button className="tree-file" onClick={() => loadDirectory(parent)}><ArrowLeft size={14} /><span>..</span></button>}
        {visibleEntries.map((entry) => <button className={`tree-file ${document?.path === entry.path ? "active" : ""}`} key={entry.path} onClick={() => entry.type === "directory" ? loadDirectory(entry.path) : openFile(entry.path)}>
          {entry.type === "directory" ? <FolderOpen size={14} /> : entry.text ? <FileText size={14} /> : <File size={14} />}<span>{entry.name}</span><small>{entry.type === "file" ? formatBytes(entry.bytes) : ""}</small>
        </button>)}
        {!visibleEntries.length && <p className="file-empty">{searchResults ? "No search results." : "This directory is empty."}</p>}
      </div>
      <div className="file-sidebar-bottom"><button onClick={search}><Search size={14} />Search workspace</button><span>{visibleEntries.length} entries shown</span></div>
    </aside>
    <section className="editor-shell">
      <div className="editor-toolbar">
        <div className="file-breadcrumb">{document?.path || path || "Workspace root"}</div>
        <div className="editor-actions">{document && <><span className="readonly-badge"><ShieldCheck size={12} />Atomic save</span><button className="button primary" onClick={save} disabled={busy || draft === document.content}><Save size={14} />Save</button></>}</div>
      </div>
      {error && <div className="phase4-error">{error}</div>}
      {document ? <div className="phase4-editor-layout">
        <div className="code-editor"><div className="line-numbers">{draft.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} /></div>
        <aside className="backup-panel"><h3><History size={15} />Version backups</h3><p>Every overwrite creates a restorable copy.</p>{backups.map((backup) => <button key={backup.id} onClick={() => restore(backup)} disabled={busy}><span>{new Date(backup.createdAt).toLocaleString()}</span><small>{formatBytes(backup.bytes)}</small><RotateCcw size={13} /></button>)}{!backups.length && <small>No previous version yet.</small>}</aside>
      </div> : <div className="phase4-placeholder"><FolderOpen size={34} /><h2>Bounded workspace</h2><p>Select a text file to inspect or edit it. Binary files remain visible as metadata only.</p></div>}
      <footer className="editor-status"><span><i />{document && draft !== document.content ? "unsaved changes" : "synchronized"}</span><span>UTF-8</span><span>512 KiB write limit</span><strong><ShieldCheck size={11} />No symlinks · allowlisted root</strong></footer>
    </section>
  </div>;
}
