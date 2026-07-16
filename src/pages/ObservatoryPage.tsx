import { ArrowUpRight, Bot, Check, Clock3, Command, Cpu, Eye, EyeOff, FileText, Gauge, MoreHorizontal, Network, Play, Radio, RotateCcw, Settings2, Sparkles, Zap } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { activity, initialAgents, missions } from "../data/mockData";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useNavigate } from "react-router-dom";

type WidgetKey = "brief" | "metrics" | "agents" | "mission" | "activity";

const widgetLabels: Record<WidgetKey, string> = {
  brief: "Brief de Pi",
  metrics: "Métriques",
  agents: "Agents au travail",
  mission: "Mission principale",
  activity: "Activité récente",
};

const defaultWidgets: Record<WidgetKey, boolean> = {
  brief: true,
  metrics: true,
  agents: true,
  mission: true,
  activity: true,
};

export function ObservatoryPage() {
  const navigate = useNavigate();
  const activeAgents = initialAgents.filter((agent) => agent.status === "active");
  const [customizing, setCustomizing] = useLocalStorage("pi-os-observatory-customizing", false);
  const [widgets, setWidgets] = useLocalStorage<Record<WidgetKey, boolean>>("pi-os-observatory-widgets", defaultWidgets);
  const toggleWidget = (key: WidgetKey) => setWidgets({ ...widgets, [key]: !widgets[key] });

  return (
    <div className="page observatory-page">
      <PageHeader
        eyebrow="Système nominal · 15 juillet 2026"
        title="Bonjour, Paul."
        description="Votre intelligence locale est en orbite. Voici ce qui mérite votre attention aujourd'hui."
        actions={<><button className={"button secondary " + (customizing ? "active" : "")} onClick={() => setCustomizing(!customizing)}><Settings2 size={15} />Personnaliser</button><button className="button secondary"><Play size={15} />Lancer un cycle</button><button className="button primary" onClick={() => navigate("/chat/pi")}><Sparkles size={15} />Parler à Pi</button></>}
      />

      <section className="orbital-launchpad reveal">
        <button onClick={() => navigate("/chat/pi")}><span className="tone-cyan"><Bot size={16} /></span><span><strong>Pi Chat</strong><small>Orchestrer et déléguer</small></span><em><i />ONLINE</em></button>
        <button onClick={() => navigate("/chat/codex")}><span className="tone-violet"><Command size={16} /></span><span><strong>Codex Chat</strong><small>Planifier et construire</small></span><em><i />READY</em></button>
        <button onClick={() => navigate("/vibe")}><span className="tone-amber"><Zap size={16} /></span><span><strong>Vibe Cockpit</strong><small>Docs, skills et repo chat</small></span><em>LAB</em></button>
        <button onClick={() => navigate("/switchboard")}><span className="tone-rose"><Network size={16} /></span><span><strong>Switchboard</strong><small>7 connexions visibles</small></span><em><i />NOMINAL</em></button>
        <button onClick={() => navigate("/control")}><span className="tone-cyan"><Gauge size={16} /></span><span><strong>Control Center</strong><small>Services, logs et config</small></span><em><Radio size={11} />LIVE</em></button>
      </section>

      {customizing && (
        <section className="observatory-customizer glass-panel reveal">
          <div><Settings2 size={16} /><span><strong>Composer l'Observatoire</strong><small>Choisissez les informations visibles. Votre disposition reste enregistrée localement.</small></span></div>
          <div className="widget-toggles">
            {(Object.keys(widgetLabels) as WidgetKey[]).map((key) => (
              <button className={widgets[key] ? "active" : ""} key={key} onClick={() => toggleWidget(key)}>{widgets[key] ? <Eye size={13} /> : <EyeOff size={13} />}{widgetLabels[key]}</button>
            ))}
            <button onClick={() => setWidgets(defaultWidgets)}><RotateCcw size={13} />Réinitialiser</button>
          </div>
        </section>
      )}

      <section className={"hero-grid reveal delay-1 " + (!widgets.brief ? "single" : "")}>
        <article className="command-card glass-panel">
          <div className="command-card-copy">
            <div className="live-label"><span className="pulse-dot" /> Intelligence en cours</div>
            <h2>Pi orchestre votre<br /><span>espace de travail.</span></h2>
            <p>Deux agents analysent le workspace pendant que la mémoire locale consolide les changements.</p>
            <div className="command-actions"><button className="button primary">Voir la mission <ArrowUpRight size={15} /></button><button className="button ghost"><MoreHorizontal size={17} /></button></div>
          </div>
          <div className="orbit-visual" aria-label="Hiérarchie active des agents">
            <div className="orbit-ring orbit-ring-one" />
            <div className="orbit-ring orbit-ring-two" />
            <div className="orbit-core"><div className="core-glow" /><Bot size={26} /><small>PI CORE</small></div>
            <div className="orbit-node node-atlas"><Avatar name="Atlas" color="violet" size="sm" /><span>Atlas</span></div>
            <div className="orbit-node node-muse"><Avatar name="Muse" color="rose" size="sm" /><span>Muse</span></div>
            <div className="orbit-node node-index"><Cpu size={14} /><span>Indexer</span></div>
          </div>
        </article>

        {widgets.brief && <article className="morning-card glass-panel">
          <div className="panel-heading"><div><p className="eyebrow"><span />Morning brief</p><h3>La synthèse de Pi</h3></div><button className="icon-button"><ArrowUpRight size={16} /></button></div>
          <p className="brief-lead">“La structure est claire. Le meilleur prochain mouvement est de stabiliser les rôles agents avant d'automatiser.”</p>
          <div className="brief-points">
            <div><span className="point-icon cyan"><Check size={13} /></span><p><strong>28 dépendances cartographiées</strong><small>Atlas a terminé l'analyse du frontend.</small></p></div>
            <div><span className="point-icon violet"><Zap size={13} /></span><p><strong>Une décision recommandée</strong><small>Valider la hiérarchie des agents.</small></p></div>
            <div><span className="point-icon amber"><Clock3 size={13} /></span><p><strong>2 automatisations planifiées</strong><small>Le prochain cycle démarre à 23:00.</small></p></div>
          </div>
          <button className="text-button">Ouvrir le brief complet <ArrowUpRight size={14} /></button>
        </article>}
      </section>

      {widgets.metrics && <section className="metric-grid reveal delay-2">
        <article className="metric-card"><div className="metric-icon cyan"><Bot size={18} /></div><div><p>Agents en ligne</p><strong>03 <small>/ 04</small></strong><span className="metric-delta">+1 cette semaine</span></div></article>
        <article className="metric-card"><div className="metric-icon violet"><Zap size={18} /></div><div><p>Missions actives</p><strong>04</strong><span>2 progressent maintenant</span></div></article>
        <article className="metric-card"><div className="metric-icon rose"><FileText size={18} /></div><div><p>Fichiers indexés</p><strong>142</strong><span>12 liens créés aujourd'hui</span></div></article>
        <article className="metric-card"><div className="metric-icon amber"><Cpu size={18} /></div><div><p>Contexte utilisé</p><strong>34%</strong><span>128k tokens disponibles</span></div></article>
      </section>}

      {(widgets.agents || widgets.mission || widgets.activity) && <section className="dashboard-grid reveal delay-3">
        {widgets.agents && <article className="glass-panel agents-now">
          <div className="panel-heading"><div><p className="section-kicker">Temps réel</p><h3>Agents au travail</h3></div><button className="text-button">Tous les agents <ArrowUpRight size={14} /></button></div>
          <div className="agent-run-list">
            {activeAgents.map((agent) => (
              <div className="agent-run" key={agent.id}>
                <Avatar name={agent.name} color={agent.color} />
                <div className="agent-run-main"><div><strong>{agent.name}</strong><span>{agent.task}</span></div><div className="mini-progress"><i style={{ width: `${agent.progress}%` }} /></div></div>
                <div className="agent-run-value"><strong>{agent.progress}%</strong><span>en cours</span></div>
              </div>
            ))}
            <div className="agent-run dormant"><Avatar name="Muse" color="rose" /><div className="agent-run-main"><div><strong>Muse</strong><span>En veille · prête à intervenir</span></div></div><span className="status-pill idle">Idle</span></div>
          </div>
        </article>}

        {widgets.mission && <article className="glass-panel mission-focus">
          <div className="panel-heading"><div><p className="section-kicker">Focus</p><h3>Mission principale</h3></div><span className="status-pill active">En cours</span></div>
          <div className="mission-orbit"><span>64%</span><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51" /><circle className="progress-circle" cx="60" cy="60" r="51" /></svg></div>
          <h4>{missions[0].title}</h4><p>Définir l'expérience complète et les frontières du prototype frontend.</p>
          <div className="mission-meta"><span><Avatar name="Pi Core" color="cyan" size="sm" /> Pi Core</span><span><Clock3 size={13} /> Aujourd'hui</span></div>
        </article>}

        {widgets.activity && <article className="glass-panel activity-panel">
          <div className="panel-heading"><div><p className="section-kicker">Flux système</p><h3>Activité récente</h3></div><button className="icon-button"><MoreHorizontal size={16} /></button></div>
          <div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.time + item.agent}><span className={`activity-dot tone-${item.tone}`} /><div><p><strong>{item.agent}</strong> {item.text}</p><small>{item.time}</small></div></div>)}</div>
        </article>}
      </section>}
    </div>
  );
}
