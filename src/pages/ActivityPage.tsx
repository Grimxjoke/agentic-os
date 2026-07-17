import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, Filter, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { ActivityEvent } from "../types";

export function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => api<{ activity: ActivityEvent[] }>("/activity?limit=100")
    .then((result) => { setEvents(result.activity); setError(""); })
    .catch((cause) => setError(cause instanceof Error ? cause.message : "Ledger indisponible")), []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => events.filter((event) => `${event.type} ${event.message}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  return <div className="page activity-page"><PageHeader eyebrow="Persistent event ledger" title="Activity" description="Événements réellement écrits par le control-plane, classés du plus récent au plus ancien." actions={<button className="button secondary" onClick={() => void load()}><RefreshCw size={14} />Actualiser</button>} />
    {error && <div className="agent-alert"><CircleAlert size={14} />{error}</div>}
    <div className="toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un événement…" /></div><button className="button secondary" disabled><Filter size={14} />{filtered.length} événements</button><span className="ledger-integrity"><CheckCircle2 size={13} />SQLite WAL</span></div>
    <section className="real-activity-ledger glass-panel reveal delay-2">{filtered.map((event) => <article key={event.id}><i className={event.level} /><time>{new Date(event.createdAt).toLocaleString("fr-FR")}</time><span><strong>{event.message}</strong><small>{event.type}{event.jobId ? ` · job ${event.jobId.slice(0, 8)}` : ""}</small></span><em>{event.level}</em></article>)}{!filtered.length && <div className="observatory-empty"><Activity size={18} /><span>Aucun événement correspondant.</span></div>}</section>
  </div>;
}
