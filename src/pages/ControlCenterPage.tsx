import { useState } from "react";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, ChevronDown, CircleStop, CloudCog,
  Code2, Command, Cpu, Database, FileCog, FolderSync, Gauge, GitBranch, HardDrive,
  KeyRound, ListRestart, Network, Play, Radio, RefreshCw, Rocket, Save, Server,
  Settings2, ShieldCheck, SlidersHorizontal, Sparkles, TerminalSquare, Timer,
  ToggleLeft, WandSparkles, Workflow, Zap,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type ServiceState = "running" | "standby" | "stopped";
type Service = { id: string; name: string; port: string; state: ServiceState; cpu: number; memory: number; icon: string };
const seedServices: Service[] = [
  { id: "frontend", name: "Orbit Frontend", port: ":4173", state: "running", cpu: 4, memory: 128, icon: "code" },
  { id: "pi", name: "Pi Runtime", port: "local RPC", state: "standby", cpu: 0, memory: 0, icon: "bot" },
  { id: "codex", name: "Codex Bridge", port: "OAuth future", state: "standby", cpu: 0, memory: 0, icon: "command" },
  { id: "vibe", name: "Vibe-Trading", port: ":8899 future", state: "stopped", cpu: 0, memory: 0, icon: "zap" },
  { id: "indexer", name: "Workspace Indexer", port: "worker", state: "running", cpu: 7, memory: 82, icon: "database" },
  { id: "cron", name: "Cron Scheduler", port: "worker", state: "running", cpu: 2, memory: 34, icon: "timer" },
];
const iconMap = { code: Code2, bot: Bot, command: Command, zap: Zap, database: Database, timer: Timer };
const initialLogs = [
  "14:42:18  frontend   Vite HMR connection ready",
  "14:42:04  indexer    142 workspace files mapped",
  "14:41:52  scheduler  next Dream Sequence at 23:00",
  "14:41:31  system     V0.4 control plane initialized",
];

export function ControlCenterPage() {
  const [services, setServices] = useLocalStorage<Service[]>("orbit-control-services", seedServices);
  const [logs, setLogs] = useLocalStorage<string[]>("orbit-control-logs", initialLogs);
  const [environment, setEnvironment] = useLocalStorage("orbit-control-env", "Localhost");
  const [autoSave, setAutoSave] = useLocalStorage("orbit-control-autosave", true);
  const [autoIndex, setAutoIndex] = useLocalStorage("orbit-control-autoindex", true);
  const [safeMode, setSafeMode] = useLocalStorage("orbit-control-safe", true);
  const [activeLog, setActiveLog] = useState("All services");
  const [deploying, setDeploying] = useState(false);
  const running = services.filter((service) => service.state === "running").length;

  const action = (id: string, state: ServiceState, verb: string) => {
    setServices((current) => current.map((service) => service.id === id ? { ...service, state, cpu: state === "running" ? Math.max(service.cpu, 3) : 0, memory: state === "running" ? Math.max(service.memory, 42) : 0 } : service));
    const service = services.find((item) => item.id === id);
    setLogs((current) => [new Date().toLocaleTimeString("fr-FR") + "  " + id.padEnd(10) + verb + " simulé · " + service?.name, ...current].slice(0, 18));
  };
  const deploy = () => {
    setDeploying(true);
    setLogs((current) => [new Date().toLocaleTimeString("fr-FR") + "  deploy     pipeline V0.4 démarré", ...current]);
    window.setTimeout(() => { setDeploying(false); setLogs((current) => [new Date().toLocaleTimeString("fr-FR") + "  deploy     build vérifié · preview ready", ...current]); }, 1600);
  };

  return <div className="page control-page">
    <PageHeader eyebrow="No-terminal operations" title="Control Center" description="Le poste de pilotage visuel pour services, modèles, fichiers, Git, déploiements et configuration — toutes les actions restent simulées en V0.4." actions={<><label className="environment-select"><CloudCog size={14} /><select value={environment} onChange={(event) => setEnvironment(event.target.value)}><option>Localhost</option><option>VPS Production · future</option><option>Sandbox · future</option></select><ChevronDown size={13} /></label><button className="button primary" onClick={deploy}><Rocket size={14} />{deploying ? "Déploiement…" : "Simuler un déploiement"}</button></>} />

    <section className="control-statusbar reveal delay-1">
      <div><span className="control-status-icon"><Gauge size={18} /></span><p><strong>{running}/{services.length}</strong><small>Services actifs</small></p></div>
      <div><span className="control-status-icon violet"><Network size={18} /></span><p><strong>7</strong><small>Connexions</small></p></div>
      <div><span className="control-status-icon rose"><HardDrive size={18} /></span><p><strong>142</strong><small>Fichiers suivis</small></p></div>
      <div><span className="control-status-icon amber"><ShieldCheck size={18} /></span><p><strong>Safe</strong><small>Simulation only</small></p></div>
      <span className="control-heartbeat"><Radio size={13} />{environment} nominal</span>
    </section>

    <div className="control-grid reveal delay-2">
      <section className="service-console glass-panel">
        <header><div><p className="section-kicker">Runtime manager</p><h3>Services</h3></div><div><button className="button secondary compact" onClick={() => setServices(seedServices)}><RefreshCw size={13} />Reset</button><button className="button secondary compact"><Play size={13} />Tout démarrer</button></div></header>
        <div className="service-table-head"><span>SERVICE</span><span>ÉTAT</span><span>RESSOURCES</span><span>CONTRÔLES</span></div>
        <div className="service-control-list">{services.map((service) => { const Icon = iconMap[service.icon as keyof typeof iconMap] ?? Server; return <article key={service.id}><span className={"runtime-icon state-" + service.state}><Icon size={16} /></span><div className="runtime-name"><strong>{service.name}</strong><small>{service.port}</small></div><span className={"runtime-state " + service.state}><i />{service.state}</span><div className="runtime-meters"><span><i style={{ width: service.cpu * 3 + "%" }} />CPU {service.cpu}%</span><span><i style={{ width: Math.min(service.memory / 2, 100) + "%" }} />RAM {service.memory} MB</span></div><div className="runtime-actions"><button className="icon-button" aria-label={"Démarrer " + service.name} onClick={() => action(service.id, "running", "start")}><Play size={14} /></button><button className="icon-button" aria-label={"Redémarrer " + service.name} onClick={() => action(service.id, "running", "restart")}><ListRestart size={14} /></button><button className="icon-button danger" aria-label={"Arrêter " + service.name} onClick={() => action(service.id, "stopped", "stop")}><CircleStop size={14} /></button></div></article>; })}</div>
      </section>

      <aside className="quick-controls glass-panel">
        <header><div><p className="section-kicker">Visual config</p><h3>Réglages rapides</h3></div><Settings2 size={17} /></header>
        <div className="quick-switches">
          <ControlSwitch icon={Save} title="Autosave" detail="Écrit les états UI localement" checked={autoSave} onChange={setAutoSave} />
          <ControlSwitch icon={FolderSync} title="Auto-index" detail="Rafraîchit le graphe de fichiers" checked={autoIndex} onChange={setAutoIndex} />
          <ControlSwitch icon={ShieldCheck} title="Safe simulation" detail="Bloque les actions système réelles" checked={safeMode} onChange={setSafeMode} />
        </div>
        <div className="control-divider" />
        <p className="detail-label">Routage des agents</p>
        <div className="model-routing"><button><Bot size={15} /><span><strong>Pi Core</strong><small>Orchestration runtime</small></span><em>PRIMARY</em></button><button><Command size={15} /><span><strong>Codex</strong><small>OpenAI subscription</small></span><em>BUILD</em></button><button><WandSparkles size={15} /><span><strong>Sub-agents</strong><small>Shared pool · 3</small></span><em>AUTO</em></button></div>
        <button className="button secondary full"><SlidersHorizontal size={14} />Ouvrir le routeur complet</button>
      </aside>
    </div>

    <section className="ops-actions reveal delay-3">
      <QuickAction icon={GitBranch} title="Git Studio" detail="Branches, commits et diff" badge="12 changes" />
      <QuickAction icon={FileCog} title="Config Files" detail=".env, JSON, YAML" badge="6 files" />
      <QuickAction icon={KeyRound} title="Secrets Vault" detail="Références masquées" badge="locked" />
      <QuickAction icon={Database} title="Database Studio" detail="Schémas et migrations" badge="future" />
      <QuickAction icon={Workflow} title="Process Manager" detail="Jobs et workers" badge="3 active" />
      <QuickAction icon={TerminalSquare} title="Emergency CLI" detail="Accès exceptionnel" badge="restricted" warning />
    </section>

    <div className="control-bottom-grid reveal delay-3">
      <section className="deployment-pipeline glass-panel">
        <header><div><p className="section-kicker">Visual deployment</p><h3>Pipeline V0.4</h3></div><span className={deploying ? "running" : ""}><Activity size={13} />{deploying ? "RUNNING" : "READY"}</span></header>
        <div className="pipeline-track"><PipelineStep icon={GitBranch} title="Source" detail="Workspace" state="done" /><i /><PipelineStep icon={Code2} title="Build" detail="TypeScript + Vite" state={deploying ? "active" : "done"} /><i /><PipelineStep icon={ShieldCheck} title="Verify" detail="Routes + assets" state={deploying ? "waiting" : "done"} /><i /><PipelineStep icon={Rocket} title="Preview" detail="localhost:4173" state={deploying ? "waiting" : "ready"} /></div>
      </section>

      <section className="live-logs glass-panel">
        <header><div><p className="section-kicker">Observable output</p><h3>Live Logs</h3></div><label><select value={activeLog} onChange={(event) => setActiveLog(event.target.value)}><option>All services</option>{services.map((service) => <option key={service.id}>{service.name}</option>)}</select><ChevronDown size={12} /></label></header>
        <pre>{logs.map((line, index) => <code key={index} className={line.includes("stop") ? "warn" : ""}>{line}</code>)}</pre>
        <footer><span><i />Streaming simulé</span><button className="text-button" onClick={() => setLogs([])}>Effacer</button></footer>
      </section>
    </div>

    {!safeMode && <div className="safe-mode-warning"><AlertTriangle size={16} /><span><strong>Safe simulation désactivée dans l’interface</strong><small>Les actions restent néanmoins simulées tant que le backend n’est pas connecté.</small></span><button className="button primary compact" onClick={() => setSafeMode(true)}>Réactiver</button></div>}
  </div>;
}

function ControlSwitch({ icon: Icon, title, detail, checked, onChange }: { icon: typeof Save; title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label><span className="quick-switch-icon"><Icon size={14} /></span><span><strong>{title}</strong><small>{detail}</small></span><span className="switch"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span /></span></label>;
}
function QuickAction({ icon: Icon, title, detail, badge, warning }: { icon: typeof Save; title: string; detail: string; badge: string; warning?: boolean }) {
  return <button className={warning ? "warning" : ""}><span><Icon size={17} /></span><div><strong>{title}</strong><small>{detail}</small></div><em>{badge}</em></button>;
}
function PipelineStep({ icon: Icon, title, detail, state }: { icon: typeof Save; title: string; detail: string; state: string }) {
  return <div className={"pipeline-step " + state}><span><Icon size={16} /></span><strong>{title}</strong><small>{detail}</small>{state === "done" && <CheckCircle2 size={12} />}</div>;
}
