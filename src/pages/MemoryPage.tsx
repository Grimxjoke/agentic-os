import { useState } from "react";
import { BrainCircuit, Check, Clock3, Database, Edit3, Pin, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type Memory = { id: string; title: string; content: string; type: string; source: string; confidence: number; pinned: boolean; };
const seed: Memory[] = [
  { id: "m1", title: "Vision produit", content: "L'Agentic OS doit rendre le système complexe calme, visible et manipulable sans terminal.", type: "Permanent", source: "vision.md", confidence: 100, pinned: true },
  { id: "m2", title: "Préférence visuelle", content: "Direction observatoire futuriste sombre, accents cyan, violet et mouvements subtils.", type: "Préférence", source: "Conversation", confidence: 98, pinned: true },
  { id: "m3", title: "Périmètre trading", content: "Vibe-Trading reste simulé dans le frontend avant une intégration backend ultérieure.", type: "Projet", source: "Cadrage V0.1", confidence: 96, pinned: false },
  { id: "m4", title: "Interface principale", content: "L'Observatoire est le cœur quotidien du produit et doit agréger les autres modules.", type: "Décision", source: "Cadrage V0.2", confidence: 100, pinned: true },
];

export function MemoryPage() {
  const [memories, setMemories] = useLocalStorage<Memory[]>("pi-os-memory", seed);
  const [selectedId, setSelectedId] = useState(memories[0]?.id ?? "");
  const selected = memories.find((memory) => memory.id === selectedId) ?? memories[0];
  const update = (content: string) => setMemories((current) => current.map((memory) => memory.id === selected.id ? { ...memory, content } : memory));
  return <div className="page memory-page">
    <PageHeader eyebrow="Context layer" title="Memory Inspector" description="Consultez, corrigez et épinglez ce que Pi pense savoir sur vous et vos projets." actions={<button className="button primary"><Plus size={15} />Ajouter une mémoire</button>} />
    <section className="memory-health reveal delay-1"><BrainCircuit size={20} /><div><strong>Mémoire cohérente</strong><span>4 entrées simulées · dernière consolidation il y a 12 min</span></div><em><Check size={13} />98% confiance</em></section>
    <div className="memory-layout reveal delay-2">
      <aside className="memory-list glass-panel"><label><Search size={15} /><input placeholder="Rechercher une mémoire…" /></label>{memories.map((memory) => <button key={memory.id} className={selected?.id === memory.id ? "selected" : ""} onClick={() => setSelectedId(memory.id)}><span className="memory-type-icon"><Database size={15} /></span><span><strong>{memory.title}</strong><small>{memory.type} · {memory.source}</small></span>{memory.pinned && <Pin size={12} />}</button>)}</aside>
      {selected && <section className="memory-detail glass-panel"><header><div><p className="eyebrow"><span />{selected.type}</p><h2>{selected.title}</h2></div><div><button className="icon-button"><Pin size={16} /></button><button className="icon-button"><Trash2 size={16} /></button></div></header><div className="memory-source"><span><Clock3 size={13} />Source : {selected.source}</span><span>Confiance : {selected.confidence}%</span></div><label className="memory-editor"><span><Edit3 size={13} />Contenu mémorisé</span><textarea value={selected.content} onChange={(event) => update(event.target.value)} rows={8} /></label><div className="memory-impact"><Sparkles size={17} /><div><strong>Impact sur Pi</strong><p>Cette mémoire est injectée lorsque Pi travaille sur le produit ou son interface.</p></div></div><footer><span>Sauvegarde automatique locale</span><button className="button primary"><Check size={14} />Confirmer la mémoire</button></footer></section>}
    </div>
  </div>;
}
