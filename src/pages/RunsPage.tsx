import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, GitBranch, History, Network, Play, Plus, RefreshCw, RotateCcw, Square, Trash2, Users, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { AgentDefinition, OrbitRun, RunEvent, TeamDefinition, TeamNode } from "../types";

type TeamInput = Pick<TeamDefinition, "name" | "description" | "maxConcurrency" | "nodes" | "budget">;
const terminal = new Set(["completed", "failed", "cancelled"]);

function statusLabel(status: string) {
  return ({ queued: "Queued", running: "Running", degraded: "Degraded", completed: "Completed", failed: "Failed", cancelled: "Canceled", skipped: "Skipped" } as Record<string, string>)[status] || status;
}

function readableDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function RunsPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [teams, setTeams] = useState<TeamDefinition[]>([]);
  const [runs, setRuns] = useState<OrbitRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<OrbitRun | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [editingTeam, setEditingTeam] = useState<TeamDefinition | null | undefined>(undefined);
  const [launchTeamId, setLaunchTeamId] = useState("");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRun = useCallback(async (id: string) => {
    const result = await api<{ run: OrbitRun }>(`/runs/${id}`);
    setSelectedRun(result.run);
    return result.run;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [agentData, teamData, runData] = await Promise.all([
        api<{ agents: AgentDefinition[] }>("/agents"),
        api<{ teams: TeamDefinition[] }>("/teams"),
        api<{ runs: OrbitRun[] }>("/runs"),
      ]);
      setAgents(agentData.agents);
      setTeams(teamData.teams);
      setRuns(runData.runs);
      setLaunchTeamId((current) => teamData.teams.some((team) => team.id === current) ? current : teamData.teams[0]?.id || "");
      setSelectedRunId((current) => runData.runs.some((run) => run.id === current) ? current : runData.runs[0]?.id || "");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Orchestration unavailable"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!selectedRunId) return setSelectedRun(null);
    void loadRun(selectedRunId).catch((cause) => setError(cause instanceof Error ? cause.message : "Run unavailable"));
  }, [selectedRunId, loadRun]);
  useEffect(() => {
    if (!selectedRunId || (selectedRun && terminal.has(selectedRun.status))) return;
    const stream = new EventSource(`${import.meta.env.BASE_URL}api/runs/${selectedRunId}/events`);
    stream.onmessage = (message) => {
      let event: RunEvent | null = null;
      try { event = JSON.parse(message.data) as RunEvent; } catch { return; }
      setSelectedRun((current) => current ? { ...current, events: [...(current.events || []).filter((item) => item.id !== event!.id), event!].sort((a, b) => a.id - b.id) } : current);
      if (event.type.startsWith("worker.") || event.type.startsWith("run.")) void loadRun(selectedRunId).then((run) => { if (terminal.has(run.status)) void loadAll(); });
    };
    const poll = window.setInterval(() => void loadRun(selectedRunId), 3_000);
    return () => { stream.close(); window.clearInterval(poll); };
  }, [selectedRunId, selectedRun?.status, loadRun, loadAll]);

  const saveTeam = async (input: TeamInput) => {
    setBusy(true); setError("");
    try {
      const path = editingTeam ? `/teams/${editingTeam.id}/versions` : "/teams";
      const result = await api<{ team: TeamDefinition }>(path, { method: "POST", body: JSON.stringify(input) });
      setEditingTeam(undefined);
      await loadAll();
      setLaunchTeamId(result.team.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid team"); }
    finally { setBusy(false); }
  };

  const launch = async (event: FormEvent) => {
    event.preventDefault();
    if (!launchTeamId || !objective.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ run: OrbitRun }>("/runs", { method: "POST", body: JSON.stringify({ teamId: launchTeamId, objective }) });
      setObjective("");
      setSelectedRunId(result.run.id);
      await loadAll();
      setSelectedRunId(result.run.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to launch run"); }
    finally { setBusy(false); }
  };

  const act = async (action: "cancel" | "retry") => {
    if (!selectedRun) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ run?: OrbitRun }>(`/runs/${selectedRun.id}/${action}`, { method: "POST" });
      if (result.run) setSelectedRunId(result.run.id);
      await loadAll();
      if (result.run) setSelectedRunId(result.run.id);
      else await loadRun(selectedRun.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to complete action"); }
    finally { setBusy(false); }
  };

  const activeRuns = runs.filter((run) => ["queued", "running", "degraded"].includes(run.status)).length;
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;

  return <div className="page runs-page">
    <PageHeader eyebrow="Phase 3 · Durable swarms" title="Teams & Runs" description="Compose a versioned DAG, launch it on Vibe and track each worker without losing history." actions={<><button className="button secondary" onClick={() => void loadAll()} disabled={loading}><RefreshCw size={14} />Refresh</button><button className="button primary" onClick={() => setEditingTeam(null)} disabled={!agents.length}><Plus size={15} />New team</button></>} />
    <section className="run-statline reveal delay-1"><div><Users size={16} /><span><strong>{teams.length}</strong> teams</span></div><div><Activity size={16} /><span><strong>{activeRuns}</strong> active runs</span></div><div><CheckCircle2 size={16} /><span><strong>{completedRuns}</strong> finished</span></div><div><CircleAlert size={16} /><span><strong>{failedRuns}</strong> chess</span></div></section>
    {error && <div className="agent-alert" role="alert">{error}<button className="icon-button" onClick={() => setError("")}><X size={14} /></button></div>}

    {editingTeam !== undefined && <TeamEditor agents={agents} team={editingTeam || undefined} busy={busy} onSave={saveTeam} onClose={() => setEditingTeam(undefined)} />}

    <form className="run-launch glass-panel reveal delay-2" onSubmit={launch}>
      <span className="run-launch-icon"><Play size={19} /></span><label><span>Versioned team</span><select value={launchTeamId} onChange={(event) => setLaunchTeamId(event.target.value)} disabled={!teams.length}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} · v{team.version}</option>)}</select></label><label className="run-objective"><span>Run objective</span><input value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={5000} placeholder={teams.length ? "For example: evaluate the robustness of a momentum hypothesis…" : "Create a team first"} /></label><button className="button primary" disabled={busy || !launchTeamId || !objective.trim()}><Play size={14} />Launch</button>
    </form>

    <div className="run-workspace reveal delay-3">
      <aside className="run-sidebar glass-panel">
        <header><div><p className="section-kicker">Versioned DAGs</p><h3>Teams</h3></div></header>
        <div className="team-list">{teams.map((team) => <article key={team.id}><button onClick={() => setLaunchTeamId(team.id)}><Network size={15} /><span><strong>{team.name}</strong><small>{team.nodes.length} workers · concurrency {team.maxConcurrency}</small></span><em>v{team.version}</em></button><button className="icon-button" onClick={() => setEditingTeam(team)} aria-label={`Revise ${team.name}`}><GitBranch size={13} /></button></article>)}{!loading && !teams.length && <Empty label={agents.length ? "Create your first DAG team." : "First create an agent in Agent Lab."} />}</div>
        <header className="run-list-title"><div><p className="section-kicker">Persistent history</p><h3>Runs</h3></div></header>
        <div className="run-list">{runs.map((run) => <button key={run.id} className={run.id === selectedRunId ? "active" : ""} onClick={() => setSelectedRunId(run.id)}><i className={`run-status ${run.status}`} /><span><strong>{run.snapshot.team.name}</strong><small>{run.objective}</small></span><em>{statusLabel(run.status)}</em></button>)}{!loading && !runs.length && <Empty label="No runs launched." />}</div>
      </aside>
      <section className="run-detail glass-panel">{selectedRun ? <RunDetail run={selectedRun} busy={busy} onCancel={() => void act("cancel")} onRetry={() => void act("retry")} /> : <div className="run-empty"><Activity size={28} /><strong>Select or start a run</strong><span>The timeline and attempts will appear here.</span></div>}</section>
    </div>
  </div>;
}

function RunDetail({ run, busy, onCancel, onRetry }: { run: OrbitRun; busy: boolean; onCancel: () => void; onRetry: () => void }) {
  const current = run.currentWorkers || [];
  const nodes = run.snapshot.nodes || [];
  const progress = run.totalWorkers ? Math.round((run.completedWorkers / run.totalWorkers) * 100) : 0;
  return <><header className="run-detail-head"><div><p className="section-kicker">{run.snapshot.team.name} · snapshot v{run.snapshot.team.version}</p><h2>{run.objective}</h2><span>{readableDate(run.createdAt)} · concurrence {run.maxConcurrency}</span></div><div><span className={`status-pill ${run.status}`}>{statusLabel(run.status)}</span>{!terminal.has(run.status) && <button className="button secondary compact" onClick={onCancel} disabled={busy}><Square size={13} />Cancel</button>}{terminal.has(run.status) && <button className="button secondary compact" onClick={onRetry} disabled={busy}><RotateCcw size={13} />Retry</button>}</div></header>
    <div className="run-progress"><div><span>Progression durable</span><strong>{run.completedWorkers}/{run.totalWorkers} · {progress}%</strong></div><i><b style={{ width: `${progress}%` }} /></i></div>
    <section className="run-metrics"><div><span>Measured tokens</span><strong>{run.tokensUsed == null ? "—" : run.tokensUsed.toLocaleString("en-US")}</strong></div><div><span>Measured cost</span><strong>{run.costUsd == null ? "—" : `$${run.costUsd.toFixed(4)}`}</strong></div><div><span>Artifacts</span><strong>{run.artifacts?.length || 0}</strong></div><div><span>State</span><strong>{statusLabel(run.status)}</strong></div></section>
    {run.error && <div className="run-error"><CircleAlert size={15} />{run.error}</div>}
    <section className="worker-grid">{nodes.map((node) => { const worker = current.find((item) => item.nodeKey === node.key); return <article key={node.key} className={worker?.status || "queued"}><div><Avatar name={node.agent?.name || node.label} color={node.agent?.color || "cyan"} size="sm" /><span><strong>{node.label}</strong><small>{node.agent?.name || "Agent snapshot"}</small></span><em>{statusLabel(worker?.status || "queued")}</em></div><p>{"task" in node ? node.task : "Versioned task in the snapshot."}</p>{worker?.output?.content && <div className="worker-output">{worker.output.content}</div>}<footer><span>Attempt {worker?.attempt || 1}</span><span>{worker?.tokensUsed == null ? "tokens —" : `${worker.tokensUsed} tokens`}</span></footer>{worker?.error && <small className="worker-error">{worker.error}</small>}</article>; })}</section>
    {!!run.artifacts?.length && <section className="run-artifacts"><header><p className="detail-label">Artifacts referenced</p><span>{run.artifacts.length}</span></header><div>{run.artifacts.map((artifact) => <article key={artifact.id}><strong>{artifact.name}</strong><span>{artifact.kind}</span><code>{artifact.uri}</code></article>)}</div></section>}
    <section className="run-timeline"><header><div><p className="section-kicker">Append-only timeline</p><h3>Events</h3></div><span><History size={13} />{run.events?.length || 0}</span></header><div>{[...(run.events || [])].reverse().map((event) => <article key={event.id} className={event.level}><i /><time>{new Date(event.createdAt).toLocaleTimeString("en-US")}</time><span><strong>{event.message}</strong><small>{event.type}</small></span></article>)}{!run.events?.length && <Empty label="Waiting for the first event." />}</div></section>
  </>;
}

function TeamEditor({ agents, team, busy, onSave, onClose }: { agents: AgentDefinition[]; team?: TeamDefinition; busy: boolean; onSave: (input: TeamInput) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<TeamInput>(team ? { name: team.name, description: team.description, maxConcurrency: team.maxConcurrency, nodes: team.nodes, budget: team.budget } : { name: "", description: "", maxConcurrency: 2, nodes: [], budget: { maxTokens: 1_000_000, maxCostUsd: 0, maxDurationMinutes: 120 } });
  const addNode = () => { const index = form.nodes.length + 1; const agent = agents[0]; if (!agent) return; setForm({ ...form, nodes: [...form.nodes, { key: `worker_${index}`, label: agent.name, agentVersionId: agent.versionId, task: "", dependsOn: [] }] }); };
  const updateNode = (index: number, patch: Partial<TeamNode>) => setForm({ ...form, nodes: form.nodes.map((node, nodeIndex) => nodeIndex === index ? { ...node, ...patch } : node) });
  const removeNode = (index: number) => { const removed = form.nodes[index].key; setForm({ ...form, nodes: form.nodes.filter((_, nodeIndex) => nodeIndex !== index).map((node) => ({ ...node, dependsOn: node.dependsOn.filter((key) => key !== removed) })) }); };
  const submit = (event: FormEvent) => { event.preventDefault(); void onSave(form); };
  const keys = useMemo(() => form.nodes.map((node) => node.key), [form.nodes]);
  return <div className="modal-backdrop team-modal" onMouseDown={onClose}><form className="team-editor glass-panel" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow"><span />Immutable team version</p><h2>{team ? `Revise ${team.name} as v${team.version + 1}` : "Create a DAG team"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="team-editor-body"><div className="form-grid"><label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={100} /></label><label><span>VPS concurrency</span><select value={form.maxConcurrency} onChange={(event) => setForm({ ...form, maxConcurrency: Number(event.target.value) })}><option value={1}>1 worker</option><option value={2}>2 workers maximum</option></select></label></div><label><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} maxLength={1000} /></label><div className="team-budget form-grid"><label><span>Team tokens</span><input type="number" min={1000} max={20000000} value={form.budget.maxTokens} onChange={(event) => setForm({ ...form, budget: { ...form.budget, maxTokens: Number(event.target.value) } })} /></label><label><span>Team duration (min)</span><input type="number" min={1} max={1440} value={form.budget.maxDurationMinutes} onChange={(event) => setForm({ ...form, budget: { ...form.budget, maxDurationMinutes: Number(event.target.value) } })} /></label></div><section className="team-node-editor"><header><div><p className="detail-label">DAG nodes</p><span>{form.nodes.length}/20</span></div><button type="button" className="button secondary compact" onClick={addNode} disabled={!agents.length || form.nodes.length >= 20}><Plus size={13} />Add</button></header>{form.nodes.map((node, index) => <article key={`${index}-${node.key}`}><div className="node-editor-head"><strong>Node {index + 1}</strong><button type="button" className="icon-button danger" onClick={() => removeNode(index)}><Trash2 size={13} /></button></div><div className="form-grid"><label><span>Unique key</span><input value={node.key} onChange={(event) => updateNode(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })} required /></label><label><span>Frozen agent</span><select value={node.agentVersionId} onChange={(event) => { const agent = agents.find((item) => item.versionId === event.target.value); updateNode(index, { agentVersionId: event.target.value, label: agent?.name || node.label }); }}>{agents.map((agent) => <option value={agent.versionId} key={agent.versionId}>{agent.name} · v{agent.version}</option>)}</select></label></div><label><span>Label</span><input value={node.label} onChange={(event) => updateNode(index, { label: event.target.value })} required /></label><label><span>Task</span><textarea rows={2} value={node.task} onChange={(event) => updateNode(index, { task: event.target.value })} required maxLength={2000} /></label><label><span>Dependencies</span><select multiple value={node.dependsOn} onChange={(event) => updateNode(index, { dependsOn: [...event.target.selectedOptions].map((option) => option.value) })}>{keys.filter((key) => key !== node.key).map((key) => <option key={key} value={key}>{key}</option>)}</select></label></article>)}{!form.nodes.length && <Empty label="Add at least one node to the DAG." />}</section></div><footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !form.nodes.length}>{busy ? "Validating…" : team ? "Create version" : "Create the team"}</button></footer></form></div>;
}

function Empty({ label }: { label: string }) { return <div className="run-empty compact"><Bot size={18} /><span>{label}</span></div>; }
