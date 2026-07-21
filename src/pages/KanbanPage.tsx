import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDot, Inbox, Timer } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";

type Card = { id: string; type: string; title?: string; name?: string; status: string; createdAt?: string; expiresAt?: string; risk?: string };
type Kanban = { backlog: Card[]; active: Card[]; completed: Card[]; attention: Card[] };
const columns = [{ id: "backlog", title: "Workflow backlog", icon: Timer }, { id: "active", title: "Running", icon: CircleDot }, { id: "attention", title: "Needs a decision", icon: Inbox }, { id: "completed", title: "Completed", icon: CheckCircle2 }];
export function KanbanPage() {
  const [kanban, setKanban] = useState<Kanban>({ backlog: [], active: [], attention: [], completed: [] }); const [error, setError] = useState("");
  const load = useCallback(async () => { const result = await api<{ kanban: Kanban }>("/kanban"); setKanban(result.kanban); }, []);
  useEffect(() => { load().catch((reason) => setError(reason.message)); const timer = window.setInterval(() => load().catch(() => undefined), 15_000); return () => window.clearInterval(timer); }, [load]);
  return <div className="page kanban-page"><PageHeader eyebrow="Phase 7 · derived state" title="Kanban" description="This board is read-only: it is derived from durable workflows, their runs, and Human Inbox decisions." />{error && <div className="phase4-error">{error}</div>}<section className="kanban-v2 reveal delay-1">{columns.map(({ id, title, icon: Icon }) => { const cards = kanban[id as keyof Kanban]; return <div className="kanban-v2-column" key={id}><header><span><Icon size={14} />{title}<em>{cards.length}</em></span></header><div className="kanban-v2-stack">{cards.map((card) => <article className="kanban-v2-card" key={`${card.type}:${card.id}`}><div className="card-drag-row"><span className="priority medium">{card.type.replace("_", " ")}</span><span>{card.status}</span></div><h3>{card.title || card.name || "Workflow run"}</h3><p>{card.risk ? `Risk ${card.risk} · awaiting a durable human decision.` : "Workflow state recorded by the control plane."}</p><footer><span>{card.createdAt ? new Date(card.createdAt).toLocaleString() : "Current"}</span></footer></article>)}{!cards.length && <p className="muted">Nothing here.</p>}</div></div>; })}</section></div>;
}
