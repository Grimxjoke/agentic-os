import { useState } from "react";
import { Archive, ArrowUpRight, FileCode2, FileText, Grid2X2, MoreHorizontal, Plus, Search, Sparkles } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const artifacts = [
  { name: "Product vision", type: "Markdown", updated: "12 min", description: "Vision and founding principles of Agentic OS.", gradient: "cyan", icon: FileText },
  { name: "Intelligence layer", type: "HTML", updated: "Yesterday", description: "Landing page prototype generated with Pi.", gradient: "violet", icon: FileCode2 },
  { name: "Morning brief", type: "Markdown", updated: "08:04", description: "Daily summary of missions and decisions.", gradient: "rose", icon: Sparkles },
  { name: "Agent hierarchy", type: "HTML", updated: "Monday", description: "Interactive map of agents and sub-agents.", gradient: "amber", icon: FileCode2 },
  { name: "Architecture notes", type: "Markdown", updated: "Monday", description: "Frontend decisions and future RPC borders.", gradient: "cyan", icon: FileText },
  { name: "Trading lab shell", type: "HTML", updated: "Sunday", description: "Simulated exploration of the future financial space.", gradient: "violet", icon: FileCode2 },
];

export function ArtifactsPage() {
  const [filter, setFilter] = useState("All");
  return <div className="page"><PageHeader eyebrow="Artifact library" title="Everything Pi creates, preserved" description="Reports, prototypes and documents remain visible, searchable and ready to be taken up." actions={<button className="button primary"><Plus size={15} />Nouvel artifact</button>} />
    <div className="artifact-toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input placeholder="Search for an artifact…" /></div><div className="filter-pills">{["All","Markdown","HTML"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="icon-button"><Grid2X2 size={17} /></button></div>
    <section className="artifact-grid reveal delay-2">{artifacts.filter((item) => filter === "All" || item.type === filter).map((artifact) => { const Icon = artifact.icon; return <article className="artifact-card" key={artifact.name}><div className={`artifact-preview gradient-${artifact.gradient}`}><div className="document-mini"><span /><span /><span /><b /></div><div className="artifact-type"><Icon size={14} />{artifact.type}</div><button className="artifact-open"><ArrowUpRight size={16} /></button></div><div className="artifact-copy"><div><h3>{artifact.name}</h3><button className="icon-button"><MoreHorizontal size={15} /></button></div><p>{artifact.description}</p><footer><span>Updated {artifact.updated}</span><span><Archive size={12} />Agentic OS</span></footer></div></article>; })}</section>
  </div>;
}
