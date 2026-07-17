import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Atom, FileText, GitBranch, Plus, RefreshCw, Search, ShieldCheck, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { HypothesisRecord, KnowledgeGraph, KnowledgeNode } from "../types";

type PositionedNode = KnowledgeNode & { x: number; y: number; size: number };
const blankHypothesis = { title: "", statement: "", rationale: "", status: "draft" as const, tags: "", sourceType: "manual", sourceId: "" };

export function KnowledgePage() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<KnowledgeGraph>({ generatedAt: "", nodes: [], edges: [] });
  const [hypotheses, setHypotheses] = useState<HypothesisRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(blankHypothesis);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const [graphResponse, hypothesisResponse] = await Promise.all([
        api<{ graph: KnowledgeGraph }>(`/knowledge?q=${encodeURIComponent(query)}`),
        api<{ hypotheses: HypothesisRecord[] }>(`/hypotheses?q=${encodeURIComponent(query)}`),
      ]);
      setGraph(graphResponse.graph); setHypotheses(hypothesisResponse.hypotheses);
      if (!selectedId && graphResponse.graph.nodes[0]) setSelectedId(graphResponse.graph.nodes[0].id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to derive knowledge graph"); }
    finally { setBusy(false); }
  }, [query, selectedId]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo<PositionedNode[]>(() => {
    const count = Math.max(graph.nodes.length, 1);
    return graph.nodes.slice(0, 60).map((node, index) => {
      const ring = index < 1 ? 0 : index < 13 ? 1 : 2;
      const ringIndex = ring === 1 ? index - 1 : index - 13;
      const ringCount = ring === 0 ? 1 : ring === 1 ? Math.min(12, count - 1) : Math.max(1, Math.min(47, count - 13));
      const angle = (ringIndex / ringCount) * Math.PI * 2 - Math.PI / 2;
      const radius = ring === 0 ? 0 : ring === 1 ? 25 : 41;
      return { ...node, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, size: ring === 0 ? 24 : node.type === "hypothesis" ? 17 : 14 };
    });
  }, [graph.nodes]);
  const positions = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selected = nodes.find((node) => node.id === selectedId) || nodes[0];
  const createHypothesis = async () => {
    setBusy(true); setError("");
    try {
      await api("/hypotheses", { method: "POST", body: JSON.stringify({ ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), sourceId: form.sourceId || null, sourceUri: null }) });
      setForm(blankHypothesis); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to register hypothesis"); }
    finally { setBusy(false); }
  };
  const updateStatus = async (hypothesis: HypothesisRecord, status: HypothesisRecord["status"]) => {
    await api(`/hypotheses/${hypothesis.id}`, { method: "PUT", body: JSON.stringify({ ...hypothesis, status }) }); await load();
  };
  return <div className="page knowledge-page">
    <PageHeader eyebrow="Derived knowledge graph" title="Evidence, not decorative topology" description="Orbit derives this graph from agents, teams, runs, files, hypotheses, and sourced memories. It cannot be edited by hand." actions={<button className="button secondary" onClick={load} disabled={busy}><RefreshCw size={15} />Recompute graph</button>} />
    {error && <div className="phase4-error">{error}</div>}
    <section className="knowledge-shell reveal delay-1">
      <div className="graph-panel glass-panel"><div className="graph-toolbar"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Search real entities…" /></label><div className="derived-badge"><ShieldCheck size={13} />Derived · read-only</div></div><div className="knowledge-graph" role="img" aria-label={`Derived graph with ${nodes.length} nodes`}><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{graph.edges.map((edge) => { const source = positions.get(edge.source); const target = positions.get(edge.target); return source && target ? <line key={`${edge.source}-${edge.target}-${edge.type}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} /> : null; })}</svg>{nodes.map((node) => <button key={node.id} className={`graph-node group-${group(node.type)} ${selected?.id === node.id ? "selected" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size * 2.3, height: node.size * 2.3 }} onClick={() => setSelectedId(node.id)} title={`${node.type}: ${node.label}`}><span>{node.label}</span></button>)}{!nodes.length && <div className="phase4-placeholder"><GitBranch size={28} /><h2>No connected knowledge yet</h2></div>}</div><div className="graph-legend"><span><i className="core" />Runs & teams</span><span><i className="agent" />Agents</span><span><i className="knowledge" />Evidence</span><span><i className="work" />Hypotheses</span></div></div>
      <aside className="node-inspector glass-panel">{selected ? <><div className={`node-preview group-${group(selected.type)}`}><Atom size={24} /></div><p className="eyebrow"><span />{selected.type}</p><h2>{selected.label}</h2><p>{selected.detail}</p><div className="node-metrics"><div><strong>{graph.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id).length}</strong><span>Connections</span></div><div><strong>{selected.entityId.slice(0, 8)}</strong><span>Entity ID</span></div></div><div className="node-meta"><p><FileText size={14} /><span><small>Source</small><strong>Canonical database/index</strong></span></p><p><Tag size={14} /><span><small>Relationship</small><strong>Derived on request</strong></span></p></div><button className="button secondary full" onClick={() => navigate(selected.uri)}>Open source<ArrowUpRight size={14} /></button></> : <p>Select a node.</p>}</aside>
    </section>
    <section className="hypothesis-registry reveal delay-2"><div className="hypothesis-head"><div><p className="eyebrow"><span />Strategy evidence</p><h2>Hypothesis register</h2><p>Track an idea from draft through testing to an evidence-based outcome.</p></div></div><div className="hypothesis-layout"><div className="hypothesis-list">{hypotheses.map((hypothesis) => <article key={hypothesis.id}><div><span className={`status-pill status-${hypothesis.status}`}>{hypothesis.status}</span><h3>{hypothesis.title}</h3><p>{hypothesis.statement}</p><small>{hypothesis.tags.map((tag) => `#${tag}`).join(" ") || "No tags"} · source: {hypothesis.sourceType}</small></div><select value={hypothesis.status} onChange={(event) => updateStatus(hypothesis, event.target.value as HypothesisRecord["status"])}>{["draft", "testing", "supported", "rejected", "inconclusive"].map((status) => <option key={status}>{status}</option>)}</select></article>)}{!hypotheses.length && <div className="phase4-placeholder"><Atom size={28} /><p>No hypothesis registered yet.</p></div>}</div><div className="hypothesis-form glass-panel"><h3><Plus size={15} />Register hypothesis</h3><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Volatility expansion" /></label><label>Falsifiable statement<textarea value={form.statement} onChange={(event) => setForm({ ...form, statement: event.target.value })} rows={4} /></label><label>Rationale<textarea value={form.rationale} onChange={(event) => setForm({ ...form, rationale: event.target.value })} rows={3} /></label><label>Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="volatility, breakout" /></label><button className="button primary full" onClick={createHypothesis} disabled={busy || !form.title || !form.statement}><Plus size={14} />Register</button></div></div></section>
  </div>;
}

function group(type: KnowledgeNode["type"]) {
  if (type === "agent") return "agent";
  if (type === "memory" || type === "artifact") return "knowledge";
  if (type === "hypothesis") return "work";
  return "core";
}
