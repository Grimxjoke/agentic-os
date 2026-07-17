import { useCallback, useEffect, useMemo, useState } from "react";
import { BrainCircuit, Check, Clock3, Database, Edit3, Pin, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { MemoryRecord } from "../types";

type MemoryDraft = Omit<MemoryRecord, "id" | "createdBy" | "createdAt" | "updatedAt">;
const blank: MemoryDraft = { title: "", content: "", kind: "learning", confidence: 1, pinned: false, sourceType: "manual", sourceId: null, sourceUri: null };

export function MemoryPage() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<MemoryDraft>(blank);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await api<{ memories: MemoryRecord[] }>(`/memories?q=${encodeURIComponent(query)}`);
      setMemories(response.memories);
      if (!selectedId && response.memories[0]) setSelectedId(response.memories[0].id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load memory"); }
  }, [query, selectedId]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => memories.find((memory) => memory.id === selectedId), [memories, selectedId]);
  useEffect(() => { if (selected && !creating) setDraft({ title: selected.title, content: selected.content, kind: selected.kind, confidence: selected.confidence, pinned: selected.pinned, sourceType: selected.sourceType, sourceId: selected.sourceId, sourceUri: selected.sourceUri }); }, [selected, creating]);

  const save = async () => {
    setBusy(true); setError("");
    try {
      const path = creating ? "/memories" : `/memories/${selectedId}`;
      const response = await api<{ memory: MemoryRecord }>(path, { method: creating ? "POST" : "PUT", body: JSON.stringify(draft) });
      setCreating(false); setSelectedId(response.memory.id); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save memory"); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected || !window.confirm(`Archive “${selected.title}”?`)) return;
    await api(`/memories/${selected.id}`, { method: "DELETE" }); setSelectedId(""); await load();
  };
  const begin = () => { setCreating(true); setSelectedId(""); setDraft(blank); };
  const confidence = Math.round(draft.confidence * 100);
  return <div className="page memory-page">
    <PageHeader eyebrow="Provenance-first context" title="Memory Inspector" description="Store durable facts, decisions, preferences, and learnings without losing their source." actions={<button className="button primary" onClick={begin}><Plus size={15} />Add memory</button>} />
    <section className="memory-health reveal delay-1"><BrainCircuit size={20} /><div><strong>Persistent memory</strong><span>{memories.length} active entries · SQLite-backed</span></div><em><ShieldCheck size={13} />Every record has provenance</em></section>
    {error && <div className="phase4-error">{error}</div>}
    <div className="memory-layout reveal delay-2">
      <aside className="memory-list glass-panel"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Search memory…" /></label>{memories.map((memory) => <button key={memory.id} className={selected?.id === memory.id ? "selected" : ""} onClick={() => { setCreating(false); setSelectedId(memory.id); }}><span className="memory-type-icon"><Database size={15} /></span><span><strong>{memory.title}</strong><small>{memory.kind} · {memory.sourceType}</small></span>{memory.pinned && <Pin size={12} />}</button>)}</aside>
      {(selected || creating) ? <section className="memory-detail glass-panel"><header><div><p className="eyebrow"><span />{creating ? "New memory" : draft.kind}</p><input className="phase4-title-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Memory title" /></div><div><button className={`icon-button ${draft.pinned ? "active" : ""}`} onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}><Pin size={16} /></button>{selected && <button className="icon-button" onClick={remove}><Trash2 size={16} /></button>}</div></header><div className="memory-source"><span><Clock3 size={13} />Source type: <select value={draft.sourceType} onChange={(event) => setDraft({ ...draft, sourceType: event.target.value as MemoryDraft["sourceType"] })}>{["manual", "file", "run", "agent", "hypothesis"].map((kind) => <option key={kind}>{kind}</option>)}</select></span><span>Confidence: {confidence}%</span></div><label className="memory-editor"><span><Edit3 size={13} />Stored content</span><textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={8} placeholder="What should Orbit retain?" /></label><div className="phase4-form-row"><label>Kind<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MemoryDraft["kind"] })}>{["fact", "preference", "decision", "learning"].map((kind) => <option key={kind}>{kind}</option>)}</select></label><label>Confidence<input type="range" min="0" max="1" step="0.05" value={draft.confidence} onChange={(event) => setDraft({ ...draft, confidence: Number(event.target.value) })} /></label><label>Source ID or URI<input value={draft.sourceId || ""} onChange={(event) => setDraft({ ...draft, sourceId: event.target.value || null, sourceUri: null })} placeholder="Required for non-manual sources" /></label></div><footer><span>Persisted with audit history</span><button className="button primary" onClick={save} disabled={busy || !draft.title || !draft.content}><Check size={14} />Save memory</button></footer></section> : <div className="phase4-placeholder"><BrainCircuit size={30} /><h2>No memory selected</h2><p>Select an entry or create the first durable memory.</p></div>}
    </div>
  </div>;
}
