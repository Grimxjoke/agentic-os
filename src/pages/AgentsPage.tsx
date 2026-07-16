import { ChangeEvent, FormEvent, useMemo, useState, type ReactNode } from "react";
import { BarChart3, Bot, ChevronRight, CircleDot, Command, Edit3, ImagePlus, Network, Plus, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { initialAgents } from "../data/mockData";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { Agent } from "../types";

const models = ["Claude Sonnet 4", "OpenAI Codex", "GPT-5.4", "Gemini 2.5 Pro", "DeepSeek V3"];
const availableTools = ["Filesystem", "Shell", "Web", "Git", "Terminal", "Browser", "Images", "Python", "Reports"];

export function AgentsPage() {
  const [agents, setAgents] = useLocalStorage<Agent[]>("orbit-agents", initialAgents);
  const [selectedId, setSelectedId] = useState("pi-core");
  const [editing, setEditing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const children = useMemo(() => agents.filter((agent) => agent.parentId === selected.id), [agents, selected.id]);

  const saveAgent = (agent: Agent) => {
    setAgents((current) => current.some((item) => item.id === agent.id) ? current.map((item) => item.id === agent.id ? agent : item) : [...current, agent]);
    setSelectedId(agent.id);
    setEditing(false);
  };

  return (
    <div className="page agents-page">
      <PageHeader eyebrow="Shared agent pantheon" title="Vos agents, clairement définis" description="Pi et Codex travaillent dans le même environnement et partagent ce pool de sous-agents, skills, fichiers et missions." actions={<><button className={"button secondary " + (comparing ? "active" : "")} onClick={() => setComparing(!comparing)}><BarChart3 size={15} />Comparer Lite</button><button className="button secondary"><Network size={15} />Vue hiérarchie</button><button className="button primary" onClick={() => { setSelectedId(""); setEditing(true); }}><Plus size={15} />Créer un agent</button></>} />
      <section className="agent-stats reveal delay-1"><div><strong>{agents.length.toString().padStart(2, "0")}</strong><span>Sous-agents créés</span></div><div><strong className="cyan-text">02</strong><span>Runtimes principaux</span></div><div><strong>05</strong><span>Modèles disponibles</span></div><div><strong>09</strong><span>Outils autorisés</span></div></section>

      {comparing && <section className="agent-comparison-lite glass-panel reveal">
        <header><div><p className="section-kicker">Capability matrix · Lite</p><h3>Forces principales</h3></div><span>Une lecture rapide, pas un benchmark absolu.</span></header>
        <div className="comparison-table">
          <div className="comparison-head"><span>Agent</span><span>Meilleur pour</span><span>Vitesse</span><span>Autonomie</span><span>Contexte partagé</span></div>
          <CompareRow avatar={<Avatar name="Pi Core" color="cyan" size="sm" />} name="Pi Core" focus="Orchestration · mémoire" speed={78} autonomy={92} />
          <CompareRow avatar={<span className="codex-avatar small"><Command size={13} /></span>} name="Codex" focus="Plan · build · vérification" speed={88} autonomy={87} />
          <CompareRow avatar={<Avatar name="Atlas" color="violet" size="sm" />} name="Atlas" focus="Architecture · dépendances" speed={72} autonomy={74} />
          <CompareRow avatar={<Avatar name="Muse" color="rose" size="sm" />} name="Muse" focus="Design · expérience" speed={81} autonomy={68} />
          <CompareRow avatar={<Avatar name="Heron" color="amber" size="sm" />} name="Heron" focus="Recherche quantitative" speed={65} autonomy={77} />
        </div>
      </section>}

      <div className="agents-layout reveal delay-2">
        <aside className="agent-directory glass-panel">
          <div className="directory-tools"><label><Search size={15} /><input placeholder="Rechercher…" /></label><button className="icon-button" aria-label="Filtrer les agents"><SlidersHorizontal size={16} /></button></div>
          <div className="directory-list">
            {agents.map((agent) => <button key={agent.id} className={agent.id === selected.id ? "selected" : ""} onClick={() => { setSelectedId(agent.id); setEditing(false); }}><Avatar name={agent.name} color={agent.color} src={agent.avatar} /><span><strong>{agent.name}</strong><small>{agent.role}</small></span><i className={"agent-state " + agent.status} /><ChevronRight size={15} /></button>)}
          </div>
          <button className="new-agent-row" onClick={() => { setSelectedId(""); setEditing(true); }}><Plus size={16} />Nouvel agent</button>
        </aside>

        {editing ? <AgentEditor agent={selectedId ? selected : undefined} agents={agents} onCancel={() => { setEditing(false); if (!selectedId) setSelectedId("pi-core"); }} onSave={saveAgent} /> : (
          <section className="agent-detail glass-panel">
            <div className="agent-cover"><div className={"agent-aura tone-" + selected.color} /><button className="button secondary compact" onClick={() => setEditing(true)}><Edit3 size={14} />Modifier</button></div>
            <div className="agent-identity"><Avatar name={selected.name} color={selected.color} src={selected.avatar} size="lg" /><div><div className="agent-name-line"><h2>{selected.name}</h2><span className={"status-pill " + selected.status}>{selected.status === "active" ? "Actif" : selected.status === "idle" ? "En veille" : "Pause"}</span></div><p>{selected.role}</p></div></div>
            <div className="agent-detail-grid">
              <div className="agent-main-info">
                <section><p className="detail-label">Mission</p><p className="agent-description">{selected.description}</p></section>
                <section><p className="detail-label">Instructions principales</p><div className="prompt-preview">{selected.prompt}</div></section>
                <section><div className="section-title-line"><p className="detail-label">Outils autorisés</p><span>{selected.tools.length} outils</span></div><div className="tool-tags">{selected.tools.map((tool) => <span key={tool}>{tool}</span>)}</div></section>
              </div>
              <aside className="agent-meta-panel">
                <div><span>Modèle principal</span><strong><Sparkles size={14} />{selected.model}</strong></div>
                <div><span>Parent</span><strong>{agents.find((agent) => agent.id === selected.parentId)?.name ?? "Aucun · Racine"}</strong></div>
                <div><span>Tâche actuelle</span><strong>{selected.task}</strong></div>
                <div><span>Progression</span><strong>{selected.progress}%</strong><i className="mini-progress"><b style={{ width: selected.progress + "%" }} /></i></div>
              </aside>
            </div>
            <section className="subagents-section"><div className="section-title-line"><div><p className="detail-label">Hiérarchie</p><h3>Sous-agents directs</h3></div><button className="text-button"><Plus size={14} />Ajouter</button></div>{children.length ? <div className="subagent-grid">{children.map((agent) => <button key={agent.id} onClick={() => setSelectedId(agent.id)}><Avatar name={agent.name} color={agent.color} /><span><strong>{agent.name}</strong><small>{agent.role}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="empty-subagents"><Bot size={18} /><span>Aucun sous-agent attribué</span></div>}</section>
          </section>
        )}
      </div>
    </div>
  );
}

function AgentEditor({ agent, agents, onSave, onCancel }: { agent?: Agent; agents: Agent[]; onSave: (agent: Agent) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Agent>(agent ?? { id: "agent-" + Date.now(), name: "", role: "", description: "", prompt: "", model: models[0], tools: ["Filesystem"], parentId: "pi-core", status: "idle", progress: 0, task: "Aucune tâche", color: "cyan" });
  const set = <K extends keyof Agent>(key: K, value: Agent[K]) => setForm((current) => ({ ...current, [key]: value }));
  const onImage = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => set("avatar", String(reader.result)); reader.readAsDataURL(file); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.name.trim() || !form.role.trim()) return; onSave(form); };
  return (
    <form className="agent-editor glass-panel" onSubmit={submit}>
      <header><div><p className="eyebrow"><span />Configuration</p><h2>{agent ? "Modifier " + agent.name : "Créer un nouvel agent"}</h2></div><button type="button" className="icon-button" onClick={onCancel}><X size={18} /></button></header>
      <div className="editor-scroll">
        <section className="identity-form"><label className="avatar-upload"><Avatar name={form.name || "Agent"} color={form.color} src={form.avatar} size="lg" /><span><ImagePlus size={15} />Attribuer une image<input type="file" accept="image/*" onChange={onImage} /></span></label><div className="form-grid"><label><span>Nom de l'agent</span><input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ex. Atlas" required /></label><label><span>Rôle</span><input value={form.role} onChange={(event) => set("role", event.target.value)} placeholder="Ex. Architecte système" required /></label></div></section>
        <div className="form-grid"><label><span>Modèle</span><select value={form.model} onChange={(event) => set("model", event.target.value)}>{models.map((model) => <option key={model}>{model}</option>)}</select></label><label><span>Agent parent</span><select value={form.parentId ?? ""} onChange={(event) => set("parentId", event.target.value || null)}><option value="">Aucun · Racine</option>{agents.filter((item) => item.id !== form.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
        <label><span>Description</span><textarea rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Sa responsabilité dans le système…" /></label>
        <label><span>Prompt système</span><textarea className="mono-input" rows={6} value={form.prompt} onChange={(event) => set("prompt", event.target.value)} placeholder="Définissez son comportement, ses principes et ses limites…" /></label>
        <fieldset><legend>Outils autorisés</legend><div className="tools-check-grid">{availableTools.map((tool) => <label key={tool}><input type="checkbox" checked={form.tools.includes(tool)} onChange={() => set("tools", form.tools.includes(tool) ? form.tools.filter((item) => item !== tool) : [...form.tools, tool])} /><span>{tool}</span></label>)}</div></fieldset>
        <fieldset><legend>Couleur d'identité</legend><div className="color-picker">{["cyan", "violet", "rose", "amber"].map((color) => <button type="button" aria-label={color} className={"color-dot tone-" + color + " " + (form.color === color ? "selected" : "")} key={color} onClick={() => set("color", color)} />)}</div></fieldset>
      </div>
      <footer><button type="button" className="button secondary" onClick={onCancel}>Annuler</button><button className="button primary" type="submit">{agent ? "Enregistrer" : "Créer l'agent"}</button></footer>
    </form>
  );
}

function CompareRow({ avatar, name, focus, speed, autonomy }: { avatar: ReactNode; name: string; focus: string; speed: number; autonomy: number }) {
  return <div className="comparison-row"><span>{avatar}<strong>{name}</strong></span><span>{focus}</span><span><i><b style={{ width: speed + "%" }} /></i>{speed}%</span><span><i><b style={{ width: autonomy + "%" }} /></i>{autonomy}%</span><span className="shared-ok"><CircleDot size={11} />Oui</span></div>;
}
