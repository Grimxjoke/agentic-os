import { DragEvent, useState } from "react";
import {
  CalendarDays, CheckCircle2, CircleDot, Filter, GripVertical, MessageSquare,
  MoreHorizontal, Paperclip, Plus, Search, Sparkles,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type Column = { id: string; title: string; tone: string };
type Card = { id: string; title: string; description: string; column: string; agent: string; priority: string; due: string; progress: number; tags: string[]; comments: number; files: number };

const columns: Column[] = [
  { id: "backlog", title: "Backlog", tone: "neutral" },
  { id: "progress", title: "En cours", tone: "cyan" },
  { id: "review", title: "À valider", tone: "violet" },
  { id: "done", title: "Terminé", tone: "success" },
];
const seedCards: Card[] = [
  { id: "k1", title: "Stabiliser la hiérarchie des agents", description: "Valider les rôles, parents et outils de chaque agent.", column: "progress", agent: "Pi Core", priority: "Haute", due: "Aujourd'hui", progress: 68, tags: ["agents", "architecture"], comments: 3, files: 1 },
  { id: "k2", title: "Structurer le Knowledge Graph", description: "Relier projets, notes, artifacts et conversations.", column: "progress", agent: "Atlas", priority: "Haute", due: "Demain", progress: 42, tags: ["knowledge"], comments: 1, files: 2 },
  { id: "k3", title: "Direction visuelle V0.2", description: "Vérifier la cohérence du nouvel espace Orchestration.", column: "review", agent: "Muse", priority: "Moyenne", due: "Aujourd'hui", progress: 92, tags: ["design"], comments: 4, files: 3 },
  { id: "k4", title: "Préparer l'intégration Vibe-Trading", description: "Définir les frontières du futur connecteur sans l'implémenter.", column: "backlog", agent: "Heron", priority: "Basse", due: "Plus tard", progress: 8, tags: ["trading"], comments: 0, files: 1 },
  { id: "k5", title: "Prototype frontend V0.1", description: "Créer les routes et la première charte graphique.", column: "done", agent: "Pi Core", priority: "Haute", due: "Terminé", progress: 100, tags: ["frontend"], comments: 6, files: 4 },
];

export function KanbanPage() {
  const [cards, setCards] = useLocalStorage<Card[]>("pi-os-kanban", seedCards);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const moveCard = (column: string) => {
    if (!draggedId) return;
    setCards((current) => current.map((card) => card.id === draggedId ? { ...card, column } : card));
    setDraggedId(null);
  };
  const addCard = (column: string) => {
    const card: Card = { id: "card-" + Date.now(), title: "Nouvelle mission", description: "Décrivez le résultat attendu.", column, agent: "Pi Core", priority: "Moyenne", due: "À planifier", progress: 0, tags: ["nouveau"], comments: 0, files: 0 };
    setCards((current) => [...current, card]);
  };

  return <div className="page kanban-page">
    <PageHeader eyebrow="Mission control" title="Kanban" description="Vos objectifs, agents, fichiers et échéances réunis dans un flux de travail déplaçable." actions={<button className="button primary" onClick={() => addCard("backlog")}><Plus size={15} />Nouvelle carte</button>} />
    <div className="toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input placeholder="Rechercher une carte…" /></div><button className="button secondary"><Filter size={14} />Filtrer</button><span className="kanban-live"><CircleDot size={13} />Sauvegarde locale active</span></div>
    <section className="kanban-v2 reveal delay-2">
      {columns.map((column) => {
        const items = cards.filter((card) => card.column === column.id);
        return <div className="kanban-v2-column" key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={() => moveCard(column.id)}>
          <header><span><i className={"column-dot " + column.tone} />{column.title}<em>{items.length}</em></span><button className="icon-button" onClick={() => addCard(column.id)}><Plus size={14} /></button></header>
          <div className="kanban-v2-stack">
            {items.map((card) => <article draggable onDragStart={() => setDraggedId(card.id)} onDragEnd={() => setDraggedId(null)} className={"kanban-v2-card " + (draggedId === card.id ? "dragging" : "")} key={card.id}>
              <div className="card-drag-row"><GripVertical size={14} /><span className={"priority " + card.priority.toLowerCase().replace("é", "e")}>{card.priority}</span><button className="icon-button"><MoreHorizontal size={14} /></button></div>
              <h3>{card.title}</h3><p>{card.description}</p>
              <div className="card-tags">{card.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
              {card.column !== "backlog" && <div className="mission-progress"><div><span>Progression</span><strong>{card.progress}%</strong></div><i><b style={{ width: card.progress + "%" }} /></i></div>}
              <footer><span><Avatar name={card.agent} color={card.agent === "Atlas" ? "violet" : card.agent === "Muse" ? "rose" : card.agent === "Heron" ? "amber" : "cyan"} size="sm" />{card.agent}</span><span><CalendarDays size={12} />{card.due}</span></footer>
              <div className="card-signals"><span><MessageSquare size={12} />{card.comments}</span><span><Paperclip size={12} />{card.files}</span>{card.column === "done" && <span className="done-signal"><CheckCircle2 size={12} />Livré</span>}</div>
            </article>)}
            <button className="add-card" onClick={() => addCard(column.id)}><Plus size={14} />Ajouter une carte</button>
          </div>
        </div>;
      })}
    </section>
    <div className="kanban-hint"><Sparkles size={14} /><span>Déplacez une carte entre les colonnes. Les changements sont conservés dans votre navigateur.</span></div>
  </div>;
}
