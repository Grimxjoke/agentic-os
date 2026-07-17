import { useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, MoreHorizontal, Moon, Plus, RefreshCw, Sparkles, Sun, TimerReset, Zap } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";

const seedAutomations = [
  { id: 1, name: "Dream sequence", description: "Reread the changes and propose three insights.", schedule: "Every day · 11:00 p.m.", next: "in 12h 18m", agent: "Pi Core", color: "cyan", enabled: true, icon: Moon },
  { id: 2, name: "Morning brief", description: "Summarize missions, files and open decisions.", schedule: "Lun–Ven · 07:45", next: "tomorrow, 07:45", agent: "Muse", color: "rose", enabled: true, icon: Sun },
  { id: 3, name: "Workspace index", description: "Update graph links and metadata.", schedule: "Every 4 hours", next: "in 1h 06m", agent: "Atlas", color: "violet", enabled: true, icon: RefreshCw },
  { id: 4, name: "Trading research pulse", description: "Prepare simulated market intelligence.", schedule: "Every Monday · 06:00", next: "disabled", agent: "Heron", color: "amber", enabled: false, icon: Zap },
];

export function AutomationsPage() {
  const [automations, setAutomations] = useState(seedAutomations);
  return (
    <div className="page">
      <PageHeader eyebrow="Autopilot" title="The system also works without you" description="Plan routines that keep memory, assignments and briefs moving." actions={<button className="button primary"><Plus size={15} />New automation</button>} />
      <section className="automation-overview reveal delay-1">
        <div className="next-run glass-panel"><div className="next-run-icon"><TimerReset size={25} /></div><div><p>Next execution</p><h2>Workspace index</h2><span><Clock3 size={13} />in 1h 06m</span></div><div className="countdown"><strong>01:06</strong><small>HOURS : MINUTES</small></div></div>
        <div className="run-stats"><article><CheckCircle2 size={18} /><strong>24</strong><span>Successful cycles</span></article><article><CalendarClock size={18} /><strong>03</strong><span>Actives</span></article><article><Sparkles size={18} /><strong>08</strong><span>Insights generated</span></article></div>
      </section>
      <section className="automation-list glass-panel reveal delay-2">
        <div className="panel-heading"><div><p className="section-kicker">Routines</p><h3>Configured automations</h3></div><div className="view-toggle"><button className="active">All</button><button>Active</button></div></div>
        <div className="automation-table">
          {automations.map((automation) => { const Icon = automation.icon; return <div className={`automation-row ${!automation.enabled ? "disabled" : ""}`} key={automation.id}><div className={`automation-icon tone-${automation.color}`}><Icon size={18} /></div><div className="automation-name"><strong>{automation.name}</strong><span>{automation.description}</span></div><div className="automation-agent"><Avatar name={automation.agent} color={automation.color} size="sm" /><span>{automation.agent}</span></div><div className="automation-schedule"><strong>{automation.schedule}</strong><span>Next: {automation.next}</span></div><label className="switch"><input type="checkbox" checked={automation.enabled} onChange={() => setAutomations((current) => current.map((item) => item.id === automation.id ? { ...item, enabled: !item.enabled } : item))} /><span /></label><button className="icon-button"><MoreHorizontal size={16} /></button></div>; })}
        </div>
      </section>
    </div>
  );
}
