import { useState } from "react";
import { ArrowUpRight, Atom, FileText, Focus, Maximize2, Search, Sparkles, Tag, ZoomIn, ZoomOut } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const nodes = [
  { id: "os", label: "Agentic OS", x: 50, y: 48, size: 28, group: "core", links: 18, description: "Central product vision" },
  { id: "pi", label: "Pi", x: 30, y: 27, size: 20, group: "agent", links: 12, description: "Lead agent and orchestrator" },
  { id: "agents", label: "Agents", x: 69, y: 25, size: 19, group: "agent", links: 9, description: "Identities and hierarchy" },
  { id: "memory", label: "Memory", x: 24, y: 66, size: 17, group: "knowledge", links: 7, description: "Sustainable context and briefs" },
  { id: "files", label: "Files", x: 72, y: 66, size: 18, group: "knowledge", links: 11, description: "Markdown and HTML documents" },
  { id: "missions", label: "Missions", x: 49, y: 79, size: 16, group: "work", links: 5, description: "Objectives and criteria" },
  { id: "trading", label: "Vibe Trading", x: 86, y: 47, size: 14, group: "future", links: 3, description: "Simulated future integration" },
  { id: "cron", label: "Automations", x: 12, y: 43, size: 14, group: "work", links: 4, description: "Scheduled routines and cycles" },
];
const edges = [["os","pi"],["os","agents"],["os","memory"],["os","files"],["os","missions"],["os","trading"],["os","cron"],["pi","agents"],["pi","memory"],["agents","missions"],["memory","files"],["files","trading"],["cron","memory"]];

export function KnowledgePage() {
  const [selectedId, setSelectedId] = useState("os");
  const selected = nodes.find((node) => node.id === selectedId)!;
  return (
    <div className="page knowledge-page">
      <PageHeader eyebrow="Knowledge graph" title="Your memory, in the form of a constellation" description="Explore relationships between projects, agents, assignments and documents in a unified view." actions={<button className="button secondary"><Sparkles size={15} />Rearrange with Pi</button>} />
      <section className="knowledge-shell reveal delay-1">
        <div className="graph-panel glass-panel">
          <div className="graph-toolbar"><label><Search size={15} /><input placeholder="Search in the graph…" /></label><div><button className="icon-button"><ZoomOut size={16} /></button><button className="icon-button"><ZoomIn size={16} /></button><button className="icon-button"><Focus size={16} /></button><button className="icon-button"><Maximize2 size={16} /></button></div></div>
          <div className="knowledge-graph" role="img" aria-label="Simulated knowledge graph">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(([a,b]) => { const source = nodes.find((node) => node.id === a)!; const target = nodes.find((node) => node.id === b)!; return <line key={`${a}-${b}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />; })}</svg>
            {nodes.map((node) => <button key={node.id} className={`graph-node group-${node.group} ${selectedId === node.id ? "selected" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size * 2.2, height: node.size * 2.2 }} onClick={() => setSelectedId(node.id)}><span>{node.label}</span></button>)}
            <div className="graph-stars" />
          </div>
          <div className="graph-legend"><span><i className="core" />Core</span><span><i className="agent" />Agents</span><span><i className="knowledge" />Knowledge</span><span><i className="work" />Work</span></div>
        </div>
        <aside className="node-inspector glass-panel">
          <div className={`node-preview group-${selected.group}`}><Atom size={24} /></div><p className="eyebrow"><span />Selected node</p><h2>{selected.label}</h2><p>{selected.description}</p>
          <div className="node-metrics"><div><strong>{selected.links}</strong><span>Connexions</span></div><div><strong>6</strong><span>Mentions</span></div></div>
          <div className="node-meta"><p><FileText size={14} /><span><small>Source file</small><strong>{selected.id}.md</strong></span></p><p><Tag size={14} /><span><small>Tags</small><strong>#system #vision</strong></span></p></div>
          <button className="button secondary full">Open in Workspace<ArrowUpRight size={14} /></button>
        </aside>
      </section>
    </div>
  );
}
