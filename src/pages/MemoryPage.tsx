import { useState } from "react";
import { BrainCircuit, Check, Clock3, Database, Edit3, Pin, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type Memory = { id: string; title: string; content: string; type: string; source: string; confidence: number; pinned: boolean; };
const seed: Memory[] = [
  { id: "m1", title: "Vision produit", content: "The Agentic OS must make the complex system calm, visible and manipulable without a terminal.", type: "Permanent", source: "vision.md", confidence: 100, pinned: true },
  { id: "m2", title: "Visual preference", content: "Dark futuristic observatory direction, cyan, purple accents and subtle movements.", type: "Preference", source: "Conversation", confidence: 98, pinned: true },
  { id: "m3", title: "Trading scope", content: "Vibe-Trading remains simulated in the frontend before subsequent backend integration.", type: "Projet", source: "Cadrage V0.1", confidence: 96, pinned: false },
  { id: "m4", title: "Interface principale", content: "The Observatory is the daily heart of the product and must aggregate the other modules.", type: "Decision", source: "Cadrage V0.2", confidence: 100, pinned: true },
];

export function MemoryPage() {
  const [memories, setMemories] = useLocalStorage<Memory[]>("pi-os-memory", seed);
  const [selectedId, setSelectedId] = useState(memories[0]?.id ?? "");
  const selected = memories.find((memory) => memory.id === selectedId) ?? memories[0];
  const update = (content: string) => setMemories((current) => current.map((memory) => memory.id === selected.id ? { ...memory, content } : memory));
  return <div className="page memory-page">
    <PageHeader eyebrow="Context layer" title="Memory Inspector" description="Review, edit, and pin what Pi thinks he knows about you and your projects." actions={<button className="button primary"><Plus size={15} />Add memory</button>} />
    <section className="memory-health reveal delay-1"><BrainCircuit size={20} /><div><strong>Coherent memory</strong><span>4 simulated entries · last consolidation 12 min ago</span></div><em><Check size={13} />98% trust</em></section>
    <div className="memory-layout reveal delay-2">
      <aside className="memory-list glass-panel"><label><Search size={15} /><input placeholder="Search for a memory…" /></label>{memories.map((memory) => <button key={memory.id} className={selected?.id === memory.id ? "selected" : ""} onClick={() => setSelectedId(memory.id)}><span className="memory-type-icon"><Database size={15} /></span><span><strong>{memory.title}</strong><small>{memory.type} · {memory.source}</small></span>{memory.pinned && <Pin size={12} />}</button>)}</aside>
      {selected && <section className="memory-detail glass-panel"><header><div><p className="eyebrow"><span />{selected.type}</p><h2>{selected.title}</h2></div><div><button className="icon-button"><Pin size={16} /></button><button className="icon-button"><Trash2 size={16} /></button></div></header><div className="memory-source"><span><Clock3 size={13} />Source: {selected.source}</span><span>Confidence: {selected.confidence}%</span></div><label className="memory-editor"><span><Edit3 size={13} />Stored content</span><textarea value={selected.content} onChange={(event) => update(event.target.value)} rows={8} /></label><div className="memory-impact"><Sparkles size={17} /><div><strong>Impact on Pi</strong><p>This memory is injected when Pi works on the product or its interface.</p></div></div><footer><span>Local automatic backup</span><button className="button primary"><Check size={14} />Confirm memory</button></footer></section>}
    </div>
  </div>;
}
