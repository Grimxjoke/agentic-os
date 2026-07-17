import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowUpRight, FileCode2, FileText, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { ArtifactRecord } from "../types";

const bytes = (value: number | null) => value === null ? "Size unavailable" : value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KiB`;

export function ArtifactsPage() {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (reindex = false) => {
    setBusy(true); setError("");
    try {
      const response = await api<{ artifacts: ArtifactRecord[] }>(reindex ? "/artifacts/reindex" : `/artifacts?q=${encodeURIComponent(query)}`, reindex ? { method: "POST" } : {});
      setArtifacts(response.artifacts);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load artifacts"); }
    finally { setBusy(false); }
  }, [query]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => artifacts.filter((artifact) => filter === "All" || artifact.sourceType === filter.toLowerCase()), [artifacts, filter]);
  const open = (artifact: ArtifactRecord) => artifact.path ? navigate(`/files?path=${encodeURIComponent(artifact.path)}`) : artifact.runId ? navigate(`/runs?run=${artifact.runId}`) : undefined;
  return <div className="page"><PageHeader eyebrow="Unified artifact index" title="Every output, with its origin intact" description="Workspace documents and run artifacts are indexed from real sources. Refreshing removes stale records." actions={<button className="button primary" onClick={() => load(true)} disabled={busy}><RefreshCw size={15} />Reindex now</button>} />
    <div className="artifact-toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Search indexed artifacts…" /></div><div className="filter-pills">{["All", "File", "Run"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div>
    {error && <div className="phase4-error">{error}</div>}
    <section className="artifact-grid reveal delay-2">{visible.map((artifact, index) => { const Icon = artifact.mimeType?.includes("markdown") ? FileText : FileCode2; return <article className="artifact-card" key={artifact.id}><div className={`artifact-preview gradient-${["cyan", "violet", "rose", "amber"][index % 4]}`}><div className="document-mini"><span /><span /><span /><b /></div><div className="artifact-type"><Icon size={14} />{artifact.kind}</div><button className="artifact-open" onClick={() => open(artifact)} aria-label={`Open ${artifact.name}`}><ArrowUpRight size={16} /></button></div><div className="artifact-copy"><div><h3>{artifact.name}</h3></div><p>{artifact.path || `Produced by run ${artifact.runId?.slice(0, 8) || "unknown"}`}</p><footer><span>{bytes(artifact.bytes)}</span><span><Archive size={12} />{artifact.sourceType === "file" ? "Workspace" : "Run"}</span></footer></div></article>; })}</section>
    {!busy && !visible.length && <div className="phase4-placeholder"><Archive size={30} /><h2>No matching artifacts</h2><p>Create a text file or complete a run, then refresh the index.</p></div>}
  </div>;
}
