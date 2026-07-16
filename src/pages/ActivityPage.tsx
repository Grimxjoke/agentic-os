import { Bot, CheckCircle2, Clock3, Code2, FileEdit, Filter, History, Play, Search, Timer, WandSparkles } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";

const events = [
  { time: "10:42:18", agent: "Atlas", color: "violet", action: "Architecture Map", detail: "28 dépendances cartographiées", target: "frontend/", icon: Code2, status: "success" },
  { time: "10:38:04", agent: "Pi Core", color: "cyan", action: "Memory consolidation", detail: "4 décisions synchronisées", target: "Memory Inspector", icon: CheckCircle2, status: "success" },
  { time: "10:31:52", agent: "Muse", color: "rose", action: "Visual Direction", detail: "Tokens de design vérifiés", target: "styles.css", icon: WandSparkles, status: "success" },
  { time: "09:58:20", agent: "System", color: "cyan", action: "Cron · Workspace index", detail: "142 fichiers indexés", target: "Knowledge Graph", icon: Timer, status: "success" },
  { time: "09:41:06", agent: "Pi Core", color: "cyan", action: "File update", detail: "Vision produit enrichie", target: "vision.md", icon: FileEdit, status: "success" },
];

export function ActivityPage() {
  return <div className="page activity-page"><PageHeader eyebrow="Audit trail" title="Activity Ledger" description="Une chronologie lisible de tout ce que les agents, skills et cron jobs ont fait dans le système." actions={<button className="button secondary"><Play size={14} />Replay simulé</button>} />
    <div className="toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input placeholder="Rechercher une action…" /></div><button className="button secondary"><Filter size={14} />Tous les agents</button><span className="ledger-integrity"><CheckCircle2 size={13} />Journal intact</span></div>
    <section className="ledger glass-panel reveal delay-2"><header><span>HEURE</span><span>ACTEUR</span><span>ACTION</span><span>CIBLE</span><span>ÉTAT</span></header>{events.map((event) => { const Icon = event.icon; return <article key={event.time}><time>{event.time}</time><span className="ledger-agent"><Avatar name={event.agent} color={event.color} size="sm" />{event.agent}</span><span className="ledger-action"><i><Icon size={14} /></i><span><strong>{event.action}</strong><small>{event.detail}</small></span></span><code>{event.target}</code><span className="ledger-status"><CheckCircle2 size={13} />Réussi</span></article>; })}</section>
    <div className="activity-retention"><History size={15} /><span>Les événements sont simulés et conservés localement pendant 30 jours.</span><Clock3 size={13} /></div>
  </div>;
}
