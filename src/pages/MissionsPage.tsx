import { ArrowRight, CalendarDays, CheckCircle2, CircleDot, Clock3, Filter, MoreHorizontal, Plus, Search } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { missions } from "../data/mockData";

const columns = ["En cours", "À valider", "En veille"];

export function MissionsPage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Mission control" title="Objectifs en orbite" description="Transformez une intention en travail observable, délégué et mesurable." actions={<button className="button primary"><Plus size={15} />Nouvelle mission</button>} />
      <div className="toolbar reveal delay-1"><div className="toolbar-search"><Search size={15} /><input placeholder="Rechercher une mission…" /></div><button className="button secondary"><Filter size={14} />Filtrer</button><div className="view-toggle"><button className="active">Board</button><button>Liste</button></div></div>
      <section className="mission-summary reveal delay-1">
        <div><span className="summary-icon cyan"><CircleDot size={16} /></span><p><strong>2</strong><small>En cours</small></p></div>
        <div><span className="summary-icon violet"><CheckCircle2 size={16} /></span><p><strong>1</strong><small>À valider</small></p></div>
        <div><span className="summary-icon amber"><Clock3 size={16} /></span><p><strong>64%</strong><small>Progression globale</small></p></div>
      </section>
      <section className="kanban reveal delay-2">
        {columns.map((column) => (
          <div className="kanban-column" key={column}>
            <div className="kanban-heading"><span><i className={`column-dot ${column === "En cours" ? "cyan" : column === "À valider" ? "violet" : "neutral"}`} />{column}<em>{missions.filter((mission) => mission.status === column).length}</em></span><button className="icon-button"><MoreHorizontal size={15} /></button></div>
            <div className="kanban-stack">
              {missions.filter((mission) => mission.status === column).map((mission) => (
                <article className="mission-card" key={mission.id}>
                  <div className="mission-card-top"><span className={`priority ${mission.priority.toLowerCase().replace("é", "e")}`}>{mission.priority}</span><button className="icon-button"><MoreHorizontal size={15} /></button></div>
                  <h3>{mission.title}</h3><p>Structurer les résultats attendus, les critères et les responsabilités.</p>
                  <div className="mission-progress"><div><span>Progression</span><strong>{mission.progress}%</strong></div><i><b style={{ width: `${mission.progress}%` }} /></i></div>
                  <footer><span><Avatar name={mission.owner} color={mission.owner === "Pi Core" ? "cyan" : mission.owner === "Atlas" ? "violet" : "rose"} size="sm" />{mission.owner}</span><span><CalendarDays size={13} />{mission.due}</span></footer>
                </article>
              ))}
              <button className="add-card"><Plus size={14} />Ajouter une mission</button>
            </div>
          </div>
        ))}
      </section>
      <button className="mission-next"><span><strong>Conseil de Pi</strong><small>Validez la mission “Définir les rôles agents” pour débloquer l'automatisation.</small></span><ArrowRight size={18} /></button>
    </div>
  );
}
