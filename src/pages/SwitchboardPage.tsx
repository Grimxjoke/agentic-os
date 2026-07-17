import { useState } from "react";
import {
  Activity, Bot, CheckCircle2, CircleOff, Cloud, Command, Cpu, Database, FolderTree,
  GitBranch, KanbanSquare, Network, Play, Radio, RefreshCw, Server, ShieldCheck,
  Sparkles, Unplug, WandSparkles, Zap,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type NodeId = "pi" | "codex" | "vps" | "workspace" | "skills" | "kanban" | "vibe" | "market";
type Connection = { id: string; from: NodeId; to: NodeId; label: string; active: boolean };
const positions: Record<NodeId, { x: number; y: number }> = {
  pi: { x: 24, y: 26 }, codex: { x: 24, y: 70 }, vps: { x: 50, y: 48 },
  workspace: { x: 75, y: 16 }, skills: { x: 81, y: 39 }, kanban: { x: 81, y: 63 },
  vibe: { x: 72, y: 84 }, market: { x: 46, y: 88 },
};
const nodeData = {
  pi: { label: "Pi Core", detail: "Orchestrateur", icon: Bot, tone: "cyan" },
  codex: { label: "Codex", detail: "Builder", icon: Command, tone: "violet" },
  vps: { label: "Shared VPS", detail: "Control plane", icon: Server, tone: "neutral" },
  workspace: { label: "Workspace", detail: "142 files", icon: FolderTree, tone: "cyan" },
  skills: { label: "Skills", detail: "77 + 9 local", icon: WandSparkles, tone: "violet" },
  kanban: { label: "Kanban", detail: "5 missions", icon: KanbanSquare, tone: "rose" },
  vibe: { label: "Vibe-Trading", detail: "Disconnected", icon: Zap, tone: "amber" },
  market: { label: "Market Data", detail: "Widget public", icon: Activity, tone: "amber" },
};
const seedConnections: Connection[] = [
  { id: "pi-vps", from: "pi", to: "vps", label: "RPC / SSH future", active: true },
  { id: "codex-vps", from: "codex", to: "vps", label: "Codex runtime", active: true },
  { id: "vps-workspace", from: "vps", to: "workspace", label: "Filesystem", active: true },
  { id: "vps-skills", from: "vps", to: "skills", label: "Skill registry", active: true },
  { id: "vps-kanban", from: "vps", to: "kanban", label: "Mission state", active: true },
  { id: "vps-vibe", from: "vps", to: "vibe", label: "MCP future", active: false },
  { id: "vibe-market", from: "vibe", to: "market", label: "Data loaders", active: false },
  { id: "pi-codex", from: "pi", to: "codex", label: "Shared handoff", active: true },
];

export function SwitchboardPage() {
  const [connections, setConnections] = useLocalStorage<Connection[]>("orbit-switchboard", seedConnections);
  const [selectedNode, setSelectedNode] = useState<NodeId>("vps");
  const [testing, setTesting] = useState(false);
  const activeCount = connections.filter((connection) => connection.active).length;
  const toggle = (id: string) => setConnections((current) => current.map((connection) => connection.id === id ? { ...connection, active: !connection.active } : connection));
  const test = () => { setTesting(true); window.setTimeout(() => setTesting(false), 1400); };
  const selected = nodeData[selectedNode];
  const SelectedIcon = selected.icon;

  return <div className="page switchboard-page">
    <PageHeader eyebrow="Shared infrastructure map" title="System Switchboard" description="Immediately see which agents, services, and spaces share context — and simulate their connections without a device." actions={<><span className="switchboard-health"><CheckCircle2 size={13} />{activeCount}/{connections.length} active links</span><button className="button primary" onClick={test}><Radio size={14} />{testing ? "Testing the signals…" : "Test connections"}</button></>} />

    <div className="switchboard-layout reveal delay-1">
      <section className="switchboard-canvas glass-panel">
        <header><div><p className="section-kicker">Topology · localhost</p><h3>Shared control plane</h3></div><div className="switchboard-legend"><span><i className="active" />Active</span><span><i />Simulated</span></div></header>
        <div className={"network-stage " + (testing ? "testing" : "")}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Connections between Pi, Codex, shared VPS and services">
            {connections.map((connection) => { const from = positions[connection.from]; const to = positions[connection.to]; return <line key={connection.id} className={connection.active ? "active" : ""} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />; })}
          </svg>
          {Object.entries(nodeData).map(([id, node]) => { const Icon = node.icon; const pos = positions[id as NodeId]; return <button key={id} className={"system-node tone-" + node.tone + " " + (selectedNode === id ? "selected" : "")} style={{ left: pos.x + "%", top: pos.y + "%" }} onClick={() => setSelectedNode(id as NodeId)}><span><Icon size={18} /></span><strong>{node.label}</strong><small>{node.detail}</small>{id === "vps" && <em><i />CORE</em>}</button>; })}
          {testing && <div className="signal-scan"><Radio size={18} /><span>Propagation of simulated signals</span></div>}
        </div>
        <footer><span><ShieldCheck size={14} />No secrets or real traffic are exposed in this view.</span><button className="text-button" onClick={() => setConnections(seedConnections)}><RefreshCw size={13} />Reset topology</button></footer>
      </section>

      <aside className="switchboard-inspector glass-panel">
        <header><span className={"selected-system-icon tone-" + selected.tone}><SelectedIcon size={20} /></span><div><p className="section-kicker">Selected system</p><h3>{selected.label}</h3></div><em><i />{selected.detail}</em></header>
        <section><p className="detail-label">Connexions</p><div className="connection-controls">{connections.filter((connection) => connection.from === selectedNode || connection.to === selectedNode).map((connection) => { const peer = connection.from === selectedNode ? nodeData[connection.to] : nodeData[connection.from]; return <button key={connection.id} className={connection.active ? "active" : ""} onClick={() => toggle(connection.id)}><span>{connection.active ? <GitBranch size={14} /> : <Unplug size={14} />}</span><span><strong>{peer.label}</strong><small>{connection.label}</small></span><em>{connection.active ? "ON" : "OFF"}</em></button>; })}</div></section>
        <section><p className="detail-label">Quick checks</p><div className="switchboard-actions"><button className="button secondary"><Play size={13} />Ping</button><button className="button secondary"><Database size={13} />Inspecter</button><button className="button secondary"><Cloud size={13} />Monter</button><button className="button secondary"><CircleOff size={13} />Isoler</button></div></section>
        <div className="shared-context-proof"><Sparkles size={16} /><div><strong>Shared context</strong><p>Pi and Codex see the same version of files, skills, agents and missions.</p></div></div>
      </aside>
    </div>

    <section className="switchboard-services reveal delay-2">
      {Object.entries(nodeData).filter(([id]) => !["pi", "codex"].includes(id)).map(([id, node]) => { const Icon = node.icon; const online = connections.some((connection) => connection.active && (connection.from === id || connection.to === id)); return <article key={id}><span className={"service-dot " + (online ? "online" : "")}><Icon size={15} /></span><div><strong>{node.label}</strong><small>{node.detail}</small></div><em>{online ? "Reachable" : "Standby"}</em><button className="icon-button" aria-label={"Configure " + node.label}><Cpu size={14} /></button></article>; })}
    </section>
  </div>;
}
