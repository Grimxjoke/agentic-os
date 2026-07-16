import { useState } from "react";
import { ArrowUpRight, Atom, FileText, Focus, Maximize2, Search, Sparkles, Tag, ZoomIn, ZoomOut } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const nodes = [
  { id: "os", label: "Agentic OS", x: 50, y: 48, size: 28, group: "core", links: 18, description: "Vision centrale du produit" },
  { id: "pi", label: "Pi", x: 30, y: 27, size: 20, group: "agent", links: 12, description: "Agent et orchestrateur principal" },
  { id: "agents", label: "Agents", x: 69, y: 25, size: 19, group: "agent", links: 9, description: "Identités et hiérarchie" },
  { id: "memory", label: "Memory", x: 24, y: 66, size: 17, group: "knowledge", links: 7, description: "Contexte durable et briefs" },
  { id: "files", label: "Files", x: 72, y: 66, size: 18, group: "knowledge", links: 11, description: "Documents Markdown et HTML" },
  { id: "missions", label: "Missions", x: 49, y: 79, size: 16, group: "work", links: 5, description: "Objectifs et critères" },
  { id: "trading", label: "Vibe Trading", x: 86, y: 47, size: 14, group: "future", links: 3, description: "Intégration future simulée" },
  { id: "cron", label: "Automations", x: 12, y: 43, size: 14, group: "work", links: 4, description: "Routines et cycles planifiés" },
];
const edges = [["os","pi"],["os","agents"],["os","memory"],["os","files"],["os","missions"],["os","trading"],["os","cron"],["pi","agents"],["pi","memory"],["agents","missions"],["memory","files"],["files","trading"],["cron","memory"]];

export function KnowledgePage() {
  const [selectedId, setSelectedId] = useState("os");
  const selected = nodes.find((node) => node.id === selectedId)!;
  return (
    <div className="page knowledge-page">
      <PageHeader eyebrow="Knowledge graph" title="Votre mémoire, sous forme de constellation" description="Explorez les relations entre projets, agents, missions et documents dans une vue unifiée." actions={<button className="button secondary"><Sparkles size={15} />Réorganiser avec Pi</button>} />
      <section className="knowledge-shell reveal delay-1">
        <div className="graph-panel glass-panel">
          <div className="graph-toolbar"><label><Search size={15} /><input placeholder="Rechercher dans le graphe…" /></label><div><button className="icon-button"><ZoomOut size={16} /></button><button className="icon-button"><ZoomIn size={16} /></button><button className="icon-button"><Focus size={16} /></button><button className="icon-button"><Maximize2 size={16} /></button></div></div>
          <div className="knowledge-graph" role="img" aria-label="Graphe simulé des connaissances">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(([a,b]) => { const source = nodes.find((node) => node.id === a)!; const target = nodes.find((node) => node.id === b)!; return <line key={`${a}-${b}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />; })}</svg>
            {nodes.map((node) => <button key={node.id} className={`graph-node group-${node.group} ${selectedId === node.id ? "selected" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size * 2.2, height: node.size * 2.2 }} onClick={() => setSelectedId(node.id)}><span>{node.label}</span></button>)}
            <div className="graph-stars" />
          </div>
          <div className="graph-legend"><span><i className="core" />Noyau</span><span><i className="agent" />Agents</span><span><i className="knowledge" />Connaissance</span><span><i className="work" />Travail</span></div>
        </div>
        <aside className="node-inspector glass-panel">
          <div className={`node-preview group-${selected.group}`}><Atom size={24} /></div><p className="eyebrow"><span />Nœud sélectionné</p><h2>{selected.label}</h2><p>{selected.description}</p>
          <div className="node-metrics"><div><strong>{selected.links}</strong><span>Connexions</span></div><div><strong>6</strong><span>Mentions</span></div></div>
          <div className="node-meta"><p><FileText size={14} /><span><small>Fichier source</small><strong>{selected.id}.md</strong></span></p><p><Tag size={14} /><span><small>Tags</small><strong>#system #vision</strong></span></p></div>
          <button className="button secondary full">Ouvrir dans Workspace <ArrowUpRight size={14} /></button>
        </aside>
      </section>
    </div>
  );
}
