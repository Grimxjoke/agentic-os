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
  { id: "progress", title: "In progress", tone: "cyan" },
  { id: "review", title: "To be validated", tone: "violet" },
  { id: "done", title: "Finished", tone: "success" },
];
const seedCards: Card[] = [
  { id: "k1", title: "Stabilize the agent hierarchy", description: "Validate the roles, parents and tools of each agent.", column: "progress", agent: "Pi Core", priority: "High", due: "Today", progress: 68, tags: ["agents", "architecture"], comments: 3, files: 1 },
  { id: "k2", title: "Structure the Knowledge Graph", description: "Connect projects, notes, artifacts and conversations.", column: "progress", agent: "Atlas", priority: "High", due: "Tomorrow", progress: 42, tags: ["knowledge"], comments: 1, files: 2 },
  { id: "k3", title: "Visual direction V0.2", description: "Check the consistency of the new Orchestration space.", column: "review", agent: "Muse", priority: "Medium", due: "Today", progress: 92, tags: ["design"], comments: 4, files: 3 },
  { id: "k4", title: "Prepare the Vibe-Trading integration", description: "Define the boundaries of the future connector without implementing it.", column: "backlog", agent: "Heron", priority: "Low", due: "Later", progress: 8, tags: ["trading"], comments: 0, files: 1 },
  { id: "k5", title: "Prototype frontend V0.1", description: "Create the routes and the first graphic charter.", column: "done", agent: "Pi Core", priority: "High", due: "Finished", progress: 100, tags: ["frontend"], comments: 6, files: 4 },
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
    const card: Card = { id: "card-" + Date.now(), title: "New mission", description: "Describe the expected result.", column, agent: "Pi Core", priority: "Medium", due: "To plan", progress: 0, tags: ["new"], comments: 0, files: 0 };
    setCards((current) => [...current, card]);
  };

  return <div className="page kanban-page">
    <PageHeader eyebrow="Mission control" title="Kanban" description="Your goals, agents, files and deadlines in one movable workflow." actions={<button className="button primary" onClick={() => addCard("backlog")}><Plus size={15} />New card</button>} />
    <div className="toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input placeholder="Search for a map…" /></div><button className="button secondary"><Filter size={14} />Filtrer</button><span className="kanban-live"><CircleDot size={13} />Active local backup</span></div>
    <section className="kanban-v2 reveal delay-2">
      {columns.map((column) => {
        const items = cards.filter((card) => card.column === column.id);
        return <div className="kanban-v2-column" key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={() => moveCard(column.id)}>
          <header><span><i className={"column-dot " + column.tone} />{column.title}<em>{items.length}</em></span><button className="icon-button" onClick={() => addCard(column.id)}><Plus size={14} /></button></header>
          <div className="kanban-v2-stack">
            {items.map((card) => <article draggable onDragStart={() => setDraggedId(card.id)} onDragEnd={() => setDraggedId(null)} className={"kanban-v2-card " + (draggedId === card.id ? "dragging" : "")} key={card.id}>
              <div className="card-drag-row"><GripVertical size={14} /><span className={"priority " + card.priority.toLowerCase().replace("e", "e")}>{card.priority}</span><button className="icon-button"><MoreHorizontal size={14} /></button></div>
              <h3>{card.title}</h3><p>{card.description}</p>
              <div className="card-tags">{card.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
              {card.column !== "backlog" && <div className="mission-progress"><div><span>Progression</span><strong>{card.progress}%</strong></div><i><b style={{ width: card.progress + "%" }} /></i></div>}
              <footer><span><Avatar name={card.agent} color={card.agent === "Atlas" ? "violet" : card.agent === "Muse" ? "rose" : card.agent === "Heron" ? "amber" : "cyan"} size="sm" />{card.agent}</span><span><CalendarDays size={12} />{card.due}</span></footer>
              <div className="card-signals"><span><MessageSquare size={12} />{card.comments}</span><span><Paperclip size={12} />{card.files}</span>{card.column === "done" && <span className="done-signal"><CheckCircle2 size={12} />Book</span>}</div>
            </article>)}
            <button className="add-card" onClick={() => addCard(column.id)}><Plus size={14} />Add a card</button>
          </div>
        </div>;
      })}
    </section>
    <div className="kanban-hint"><Sparkles size={14} /><span>Move a card between columns. Changes are saved in your browser.</span></div>
  </div>;
}
