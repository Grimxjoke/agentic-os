import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, ChevronRight, Clock3, Edit3, History, Plus, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { AgentBudget, AgentDefinition, AgentPolicy } from "../types";

const availableTools = ["filesystem", "web", "git", "terminal", "browser", "images", "python", "reports"];

type AgentInput = Pick<AgentDefinition, "name" | "role" | "description" | "instructions" | "provider" | "model" | "tools" | "skills" | "budget" | "policy" | "color">;

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [versions, setVersions] = useState<AgentDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ agents: AgentDefinition[] }>("/agents");
      setAgents(result.agents);
      setSelectedId((current) => result.agents.some((agent) => agent.id === current) ? current : result.agents[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registry unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const selected = agents.find((agent) => agent.id === selectedId);
  useEffect(() => {
    if (!selectedId) return setVersions([]);
    void api<{ versions: AgentDefinition[] }>(`/agents/${selectedId}/versions`)
      .then((result) => setVersions(result.versions))
      .catch(() => setVersions([]));
  }, [selectedId, selected?.version]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return needle ? agents.filter((agent) => `${agent.name} ${agent.role}`.toLocaleLowerCase("fr").includes(needle)) : agents;
  }, [agents, query]);
  const toolCount = new Set(agents.flatMap((agent) => agent.tools)).size;
  const providerCount = new Set(agents.map((agent) => agent.provider)).size;
  const versionCount = agents.reduce((total, agent) => total + agent.version, 0);

  const saveAgent = async (input: AgentInput) => {
    setSaving(true);
    setError("");
    try {
      const path = selected && editing ? `/agents/${selected.id}/versions` : "/agents";
      const result = await api<{ agent: AgentDefinition }>(path, { method: "POST", body: JSON.stringify(input) });
      await loadAgents();
      setSelectedId(result.agent.id);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page agents-page">
      <PageHeader eyebrow="Agent Lab · Phase 3" title="Persistent and versioned agents" description="Each revision creates an immutable version. Future runs will remain tied to the exact definition they ran." actions={<button className="button primary" onClick={() => { setSelectedId(""); setEditing(true); }}><Plus size={15} />Create an agent</button>} />

      <section className="agent-stats reveal delay-1">
        <div><strong>{agents.length.toString().padStart(2, "0")}</strong><span>Persistent agents</span></div>
        <div><strong className="cyan-text">{versionCount.toString().padStart(2, "0")}</strong><span>Immutable versions</span></div>
        <div><strong>{providerCount.toString().padStart(2, "0")}</strong><span>Configured providers</span></div>
        <div><strong>{toolCount.toString().padStart(2, "0")}</strong><span>Referenced tools</span></div>
      </section>

      {error && <div className="agent-alert" role="alert">{error}<button className="text-button" onClick={() => void loadAgents()}>Try again</button></div>}

      <div className="agents-layout reveal delay-2">
        <aside className="agent-directory glass-panel">
          <div className="directory-tools"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" /></label></div>
          <div className="directory-list">
            {filtered.map((agent) => <button key={agent.id} className={agent.id === selected?.id ? "selected" : ""} onClick={() => { setSelectedId(agent.id); setEditing(false); }}><Avatar name={agent.name} color={agent.color} /><span><strong>{agent.name}</strong><small>{agent.role}</small></span><i className="agent-version-dot">v{agent.version}</i><ChevronRight size={15} /></button>)}
            {!loading && filtered.length === 0 && <div className="agent-directory-empty">{agents.length ? "No results" : "The registry is empty"}</div>}
          </div>
          <button className="new-agent-row" onClick={() => { setSelectedId(""); setEditing(true); }}><Plus size={16} />New agent</button>
        </aside>

        {loading ? <section className="agent-empty glass-panel"><Bot size={24} /><span><strong>Loading the registry</strong><small>Reading SQLite definitions…</small></span></section>
          : editing ? <AgentEditor key={`${selected?.id || "new"}-${selected?.version || 0}`} agent={selected} saving={saving} onCancel={() => { setEditing(false); if (!selectedId) setSelectedId(agents[0]?.id || ""); }} onSave={saveAgent} />
          : selected ? <AgentDetail agent={selected} versions={versions} onEdit={() => setEditing(true)} />
          : <section className="agent-empty glass-panel"><Bot size={28} /><span><strong>Create the first agent</strong><small>Its first definition will become version 1 immutable.</small></span><button className="button primary" onClick={() => setEditing(true)}><Plus size={14} />Create</button></section>}
      </div>
    </div>
  );
}

function AgentDetail({ agent, versions, onEdit }: { agent: AgentDefinition; versions: AgentDefinition[]; onEdit: () => void }) {
  return <section className="agent-detail glass-panel">
    <div className="agent-cover"><div className={`agent-aura tone-${agent.color}`} /><button className="button secondary compact" onClick={onEdit}><Edit3 size={14} />New version</button></div>
    <div className="agent-identity"><Avatar name={agent.name} color={agent.color} size="lg" /><div><div className="agent-name-line"><h2>{agent.name}</h2><span className="status-pill active">Version {agent.version}</span></div><p>{agent.role}</p></div></div>
    <div className="agent-detail-grid">
      <div className="agent-main-info">
        <section><p className="detail-label">Mission</p><p className="agent-description">{agent.description || "No description recorded."}</p></section>
        <section><p className="detail-label">Versioned instructions</p><div className="prompt-preview">{agent.instructions}</div></section>
        <section><div className="section-title-line"><p className="detail-label">Authorized tools</p><span>{agent.tools.length} tools</span></div><div className="tool-tags">{agent.tools.length ? agent.tools.map((tool) => <span key={tool}>{tool}</span>) : <span>None</span>}</div></section>
      </div>
      <aside className="agent-meta-panel">
        <div><span>Provider/model</span><strong><Sparkles size={14} />{agent.provider} · {agent.model}</strong></div>
        <div><span>Token budget</span><strong>{agent.budget.maxTokens.toLocaleString("en-US")}</strong></div>
        <div><span>Duration/retries</span><strong><Clock3 size={14} />{agent.budget.maxDurationMinutes} min · {agent.budget.maxRetries} retry</strong></div>
        <div><span>Policies</span><strong><ShieldCheck size={14} />FS {agent.policy.filesystem} · network{agent.policy.network} · trading deny</strong></div>
      </aside>
    </div>
    <section className="subagents-section"><div className="section-title-line"><div><p className="detail-label">History</p><h3>Immutable versions</h3></div><span>{versions.length || agent.version} version(s)</span></div><div className="agent-version-list">{versions.map((version) => <article key={version.versionId}><History size={14} /><span><strong>Version {version.version}</strong><small>{version.name} · {new Date(version.versionCreatedAt).toLocaleString("en-US")}</small></span>{version.versionId === agent.versionId && <em>Current</em>}</article>)}</div></section>
  </section>;
}

function AgentEditor({ agent, saving, onSave, onCancel }: { agent?: AgentDefinition; saving: boolean; onSave: (input: AgentInput) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<AgentInput>(agent ? {
    name: agent.name, role: agent.role, description: agent.description, instructions: agent.instructions,
    provider: agent.provider, model: agent.model, tools: agent.tools, skills: agent.skills,
    budget: agent.budget, policy: agent.policy, color: agent.color,
  } : {
    name: "", role: "", description: "", instructions: "", provider: "openai-codex", model: "gpt-5.4",
    tools: ["filesystem", "web"], skills: [], budget: { maxTokens: 100_000, maxCostUsd: 0, maxDurationMinutes: 30, maxRetries: 1 },
    policy: { filesystem: "read", network: "allow", trading: "deny" }, color: "cyan",
  });
  const set = <K extends keyof AgentInput>(key: K, value: AgentInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setBudget = <K extends keyof AgentBudget>(key: K, value: number) => set("budget", { ...form.budget, [key]: value });
  const setPolicy = <K extends keyof AgentPolicy>(key: K, value: AgentPolicy[K]) => set("policy", { ...form.policy, [key]: value });
  const submit = (event: FormEvent) => { event.preventDefault(); void onSave(form); };

  return <form className="agent-editor glass-panel" onSubmit={submit}>
    <header><div><p className="eyebrow"><span />Immutable definition</p><h2>{agent ? `Create version${agent.version + 1}` : "Create an agent"}</h2></div><button type="button" className="icon-button" onClick={onCancel}><X size={18} /></button></header>
    <div className="editor-scroll">
      <section className="identity-form"><Avatar name={form.name || "Agent"} color={form.color} size="lg" /><div className="form-grid"><label><span>Name</span><input value={form.name} onChange={(event) => set("name", event.target.value)} required minLength={2} maxLength={80} /></label><label><span>Role</span><input value={form.role} onChange={(event) => set("role", event.target.value)} required minLength={2} maxLength={120} /></label></div></section>
      <div className="form-grid"><label><span>Provider</span><input value={form.provider} onChange={(event) => set("provider", event.target.value)} required /></label><label><span>Model</span><input value={form.model} onChange={(event) => set("model", event.target.value)} required /></label></div>
      <label><span>Description</span><textarea rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={1000} /></label>
      <label><span>Instructions</span><textarea className="mono-input" rows={7} value={form.instructions} onChange={(event) => set("instructions", event.target.value)} required maxLength={16000} /></label>
      <label><span>Skills (comma separated)</span><input value={form.skills.join(", ")} onChange={(event) => set("skills", event.target.value.split(",").map((skill) => skill.trim()).filter(Boolean))} placeholder="research, backtest, reporting" /></label>
      <fieldset><legend>Authorized tools</legend><div className="tools-check-grid">{availableTools.map((tool) => <label key={tool}><input type="checkbox" checked={form.tools.includes(tool)} onChange={() => set("tools", form.tools.includes(tool) ? form.tools.filter((item) => item !== tool) : [...form.tools, tool])} /><span>{tool}</span></label>)}</div></fieldset>
      <fieldset><legend>Execution budgets</legend><div className="form-grid"><label><span>Tokens maximum</span><input type="number" min={1000} max={10000000} value={form.budget.maxTokens} onChange={(event) => setBudget("maxTokens", Number(event.target.value))} /></label><label><span>Maximum duration (minutes)</span><input type="number" min={1} max={1440} value={form.budget.maxDurationMinutes} onChange={(event) => setBudget("maxDurationMinutes", Number(event.target.value))} /></label><label><span>Maximum cost (USD)</span><input type="number" min={0} max={10000} step="0.01" value={form.budget.maxCostUsd} onChange={(event) => setBudget("maxCostUsd", Number(event.target.value))} /></label><label><span>Retries maximum</span><input type="number" min={0} max={10} value={form.budget.maxRetries} onChange={(event) => setBudget("maxRetries", Number(event.target.value))} /></label></div></fieldset>
      <fieldset><legend>Policies</legend><div className="form-grid"><label><span>Filesystem</span><select value={form.policy.filesystem} onChange={(event) => setPolicy("filesystem", event.target.value as AgentPolicy["filesystem"])}><option value="deny">Interdit</option><option value="read">Reading</option><option value="write">Bounded writing</option></select></label><label><span>Network</span><select value={form.policy.network} onChange={(event) => setPolicy("network", event.target.value as AgentPolicy["network"])}><option value="deny">Interdit</option><option value="allow">Allowed</option></select></label></div><p className="agent-policy-note">Trading: prohibited during Phase 3.</p></fieldset>
      <fieldset><legend>Identity color</legend><div className="color-picker">{["cyan", "violet", "rose", "amber"].map((color) => <button type="button" aria-label={color} className={`color-dot tone-${color} ${form.color === color ? "selected" : ""}`} key={color} onClick={() => set("color", color)} />)}</div></fieldset>
    </div>
    <footer><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" type="submit" disabled={saving}>{saving ? "Enregistrement…" : agent ? "Create version" : "Create the agent"}</button></footer>
  </form>;
}
