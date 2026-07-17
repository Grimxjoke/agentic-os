import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Bot, BrainCircuit, CheckCircle2, CircleAlert, Database, FileUp,
  LoaderCircle, MessageSquareText, Network, Plus, Radio, RefreshCw, Search,
  Send, ShieldCheck, Square, Trash2, Users, WandSparkles, WifiOff, X,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api, ApiError } from "../lib/api";

type VibeTab = "chat" | "skills" | "swarms" | "runs";
type VibeOverview = {
  engine: "online" | "offline" | "degraded";
  ready: boolean;
  reason: string;
  version: string | null;
  provider: null | { name: string; model: string | null; authType: string; authorized: boolean };
};
type VibeSession = {
  session_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_attempt_id?: string | null;
};
type VibeMessage = {
  message_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  linked_attempt_id?: string | null;
};
type VibeSkill = { name: string; description: string };
type VibePreset = { name: string; title: string; description: string; agent_count: number; variables?: unknown[] };
type VibeRun = { id?: string; run_id?: string; status?: string; title?: string; created_at?: string; summary?: string };
type LiveEvent = { id: string; type: string; label: string; tone: "info" | "success" | "warning" | "error" };

const eventTypes = [
  "attempt.created", "attempt.started", "attempt.completed", "attempt.failed",
  "text_delta", "reasoning_delta", "thinking_done", "llm_usage", "tool_call",
  "tool_progress", "tool_heartbeat", "tool_result", "mcp.warning", "goal.created",
];

function eventLabel(type: string, data: Record<string, unknown>) {
  if (type === "tool_call") return `Tool launched ·${String(data.tool || "unknown")}`;
  if (type === "tool_result") return `${String(data.tool || "Tool")} · ${String(data.status || "finished")}`;
  if (type === "attempt.started") return "Search started";
  if (type === "attempt.completed") return "Search completed";
  if (type === "attempt.failed") return `Failure ·${String(data.error || "cause inconnue")}`;
  if (type === "llm_usage") return "Updated model usage";
  if (type === "thinking_done") return "Reasoning stage completed";
  return type.replaceAll("_", " ").replaceAll(".", " · ");
}

function eventTone(type: string, data: Record<string, unknown>): LiveEvent["tone"] {
  if (type.includes("failed") || data.status === "error") return "error";
  if (type.includes("warning")) return "warning";
  if (type.includes("completed") || data.status === "ok") return "success";
  return "info";
}

function readableError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "An unexpected error has occurred";
}

export function VibePage() {
  const [tab, setTab] = useState<VibeTab>("chat");
  const [overview, setOverview] = useState<VibeOverview | null>(null);
  const [sessions, setSessions] = useState<VibeSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VibeMessage[]>([]);
  const [skills, setSkills] = useState<VibeSkill[]>([]);
  const [presets, setPresets] = useState<VibePreset[]>([]);
  const [runs, setRuns] = useState<VibeRun[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [liveText, setLiveText] = useState("");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "connecting" | "live" | "retrying">("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async (sessionId: string) => {
    const result = await api<{ ok: true; messages: VibeMessage[] }>(`/vibe/sessions/${sessionId}/messages`);
    setMessages(result.messages);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await api<{ ok: true; vibe: VibeOverview }>("/vibe/overview");
      setOverview(status.vibe);
      if (status.vibe.engine !== "online") {
        setSessions([]);
        return;
      }
      const [sessionData, skillData, presetData, runData] = await Promise.all([
        api<{ ok: true; sessions: VibeSession[] }>("/vibe/sessions"),
        api<{ ok: true; skills: VibeSkill[] }>("/vibe/skills"),
        api<{ ok: true; presets: VibePreset[] }>("/vibe/presets"),
        api<{ ok: true; runs: VibeRun[] }>("/vibe/runs").catch(() => ({ ok: true as const, runs: [] })),
      ]);
      setSessions(sessionData.sessions);
      setSkills(skillData.skills);
      setPresets(presetData.presets);
      setRuns(runData.runs);
      setSelectedId((current) => current && sessionData.sessions.some((item) => item.session_id === current)
        ? current
        : sessionData.sessions[0]?.session_id || null);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setEvents([]);
    setLiveText("");
    void loadMessages(selectedId).catch((caught) => setError(readableError(caught)));
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!selectedId || overview?.engine !== "online") return;
    setStreamState("connecting");
    const stream = new EventSource(`${import.meta.env.BASE_URL}api/vibe/sessions/${selectedId}/events`);
    stream.onopen = () => setStreamState("live");
    stream.onerror = () => setStreamState("retrying");
    for (const type of eventTypes) {
      stream.addEventListener(type, (raw) => {
        const event = raw as MessageEvent<string>;
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(event.data); } catch { /* malformed upstream event is ignored */ }
        if (type === "text_delta") setLiveText((current) => current + String(data.delta || ""));
        if (type === "attempt.started") {
          setSending(true);
          setLiveText("");
        }
        if (["attempt.completed", "attempt.failed"].includes(type)) {
          setSending(false);
          setLiveText("");
          void loadMessages(selectedId);
          void loadAll();
        }
        if (type !== "text_delta" && type !== "reasoning_delta" && type !== "tool_heartbeat") {
          setEvents((current) => [{
            id: `${event.lastEventId || Date.now()}-${type}`,
            type,
            label: eventLabel(type, data),
            tone: eventTone(type, data),
          }, ...current.filter((item) => item.id !== `${event.lastEventId}-${type}`)].slice(0, 24));
        }
      });
    }
    return () => {
      stream.close();
      setStreamState("idle");
    };
  }, [selectedId, overview?.engine, loadAll, loadMessages]);

  const createSession = async () => {
    setError(null);
    try {
      const result = await api<{ ok: true; session: VibeSession }>("/vibe/sessions", {
        method: "POST",
        body: JSON.stringify({ title: "New search" }),
      });
      setSessions((current) => [result.session, ...current]);
      setSelectedId(result.session.session_id);
      setTab("chat");
    } catch (caught) { setError(readableError(caught)); }
  };

  const removeSession = async (sessionId: string) => {
    if (!window.confirm("Delete this Vibe session and its history?")) return;
    try {
      await api(`/vibe/sessions/${sessionId}`, { method: "DELETE" });
      const remaining = sessions.filter((item) => item.session_id !== sessionId);
      setSessions(remaining);
      setSelectedId(remaining[0]?.session_id || null);
    } catch (caught) { setError(readableError(caught)); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending || !overview?.ready) return;
    let sessionId = selectedId;
    setError(null);
    try {
      if (!sessionId) {
        const created = await api<{ ok: true; session: VibeSession }>("/vibe/sessions", {
          method: "POST",
          body: JSON.stringify({ title: content.slice(0, 72) }),
        });
        sessionId = created.session.session_id;
        setSessions((current) => [created.session, ...current]);
        setSelectedId(sessionId);
      }
      setMessages((current) => [...current, {
        message_id: `optimistic-${Date.now()}`,
        session_id: sessionId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      } as VibeMessage]);
      setInput("");
      setSending(true);
      await api(`/vibe/sessions/${sessionId}/messages`, { method: "POST", body: JSON.stringify({ content }) });
      await loadMessages(sessionId);
    } catch (caught) {
      setSending(false);
      setError(readableError(caught));
      if (sessionId) void loadMessages(sessionId);
    }
  };

  const cancel = async () => {
    if (!selectedId) return;
    try {
      await api(`/vibe/sessions/${selectedId}/cancel`, { method: "POST" });
      setSending(false);
    } catch (caught) { setError(readableError(caught)); }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/vibe/upload`, { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed");
      setInput((current) => `${current}${current ? "\n" : ""}Parse the file${body.upload.file_path} (${body.upload.filename}).`);
    } catch (caught) { setError(readableError(caught)); }
    finally { if (fileInput.current) fileInput.current.value = ""; }
  };

  const filteredSkills = useMemo(() => skills.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase())), [skills, query]);
  const selectedSession = sessions.find((session) => session.session_id === selectedId);
  const ready = overview?.engine === "online" && overview.ready;

  return <div className="page vibe-page vibe-real-page">
    <PageHeader
      eyebrow="Private quantitative engine"
      title="Vibe Research Deck"
      description="Persistent sessions, powered search and real-time events — the engine remains private behind Orbit."
      actions={<>
        <span className={`vibe-engine-pill ${overview?.engine || "loading"}`}><i />{overview?.engine === "online" ? (overview.ready ? "Engine ready" : "OAuth requis") : overview?.engine === "offline" ? "Hors ligne" : "Connexion…"}</span>
        <button className="button secondary" onClick={() => void loadAll()} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} />Refresh</button>
      </>}
    />

    {error && <div className="vibe-alert error"><CircleAlert size={16} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Close"><X size={14} /></button></div>}
    {overview && overview.engine === "online" && !overview.ready && <div className="vibe-alert warning"><ShieldCheck size={17} /><div><strong>Autorisation ChatGPT/Codex requise</strong><span>The engine is installed. Run the OAuth Vibe login once on the VPS; no OpenAI API key is required.</span></div></div>}
    {overview?.engine === "offline" && <div className="vibe-alert error"><WifiOff size={17} /><div><strong>Vibe-Trading not responding</strong><span>{overview.reason}</span></div></div>}

    <div className="vibe-real-statline reveal delay-1">
      <StatusMetric label="Engine" value={overview?.version ? `v${overview.version}` : overview?.engine || "—"} live={overview?.engine === "online"} />
      <StatusMetric label="Provider" value={overview?.provider?.name || "—"} live={Boolean(overview?.provider?.authorized)} />
      <StatusMetric label="Sessions" value={String(sessions.length)} live={sessions.length > 0} />
      <StatusMetric label="Skills" value={String(skills.length)} live={skills.length > 0} />
      <StatusMetric label="Swarms" value={String(presets.length)} live={presets.length > 0} />
    </div>

    <div className="vibe-tabs reveal delay-2" role="tablist">
      <Tab id="chat" tab={tab} setTab={setTab} icon={MessageSquareText} label="Research chat" />
      <Tab id="skills" tab={tab} setTab={setTab} icon={WandSparkles} label={`Skills · ${skills.length}`} />
      <Tab id="swarms" tab={tab} setTab={setTab} icon={Users} label={`Swarms · ${presets.length}`} />
      <Tab id="runs" tab={tab} setTab={setTab} icon={Database} label={`Artifacts · ${runs.length}`} />
    </div>

    <section className="vibe-content reveal delay-3">
      {tab === "chat" && <div className="vibe-workspace">
        <aside className="vibe-session-rail glass-panel">
          <header><div><p className="section-kicker">Persistent threads</p><h3>Sessions</h3></div><button className="icon-button" onClick={() => void createSession()} disabled={overview?.engine !== "online"} aria-label="New session"><Plus size={15} /></button></header>
          <div className="vibe-session-list">{sessions.map((session) => <button key={session.session_id} className={selectedId === session.session_id ? "active" : ""} onClick={() => setSelectedId(session.session_id)}><span><strong>{session.title || "Untitled"}</strong><small>{new Date(session.updated_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</small></span><i className={session.last_attempt_id ? "has-run" : ""} /></button>)}{!loading && sessions.length === 0 && <div className="vibe-empty compact"><BrainCircuit size={22} /><span>No session persisted</span></div>}</div>
        </aside>

        <section className="vibe-conversation glass-panel">
          <header><div><span className="vibe-live-orb"><Bot size={17} /></span><span><strong>{selectedSession?.title || "New search"}</strong><small>{streamState === "live" ? "Connected real-time stream" : streamState === "retrying" ? "Reconnecting the stream…" : "Vibe Agent"}</small></span></div>{selectedId && <button className="icon-button danger" onClick={() => void removeSession(selectedId!)} aria-label="Delete session"><Trash2 size={14} /></button>}</header>
          <div className="vibe-message-stream">{messages.map((message) => <article className={`vibe-message ${message.role}`} key={message.message_id}>{message.role !== "user" && <span><Bot size={14} /></span>}<div><small>{message.role === "user" ? "You" : message.role === "assistant" ? "Vibe Agent" : "System"}</small><p>{message.content}</p></div></article>)}{liveText && <article className="vibe-message assistant streaming"><span><Bot size={14} /></span><div><small>Vibe Agent · live</small><p>{liveText}<i className="typing-cursor" /></p></div></article>}{!selectedId && !loading && <div className="vibe-empty"><BrainCircuit size={29} /><strong>Create your first search</strong><span>Describe a hypothesis, market or strategy to explore.</span><button className="button primary" onClick={() => void createSession()} disabled={overview?.engine !== "online"}><Plus size={14} />New session</button></div>}</div>
          <form className="vibe-composer" onSubmit={sendMessage}><div className="vibe-composer-tools"><input ref={fileInput} type="file" hidden onChange={(event) => void upload(event.target.files?.[0])} /><button type="button" className="icon-button" onClick={() => fileInput.current?.click()} disabled={!ready} aria-label="Attach a file"><FileUp size={15} /></button><span>{input.length}/5000</span></div><textarea value={input} onChange={(event) => setInput(event.target.value.slice(0, 5000))} placeholder={ready ? "Describe a hypothesis, strategy or backtest…" : "The provider must be authorized before launching a search."} disabled={!ready} rows={3} /><button type={sending ? "button" : "submit"} onClick={sending ? () => void cancel() : undefined} className={`vibe-send ${sending ? "cancel" : ""}`} disabled={!sending && (!input.trim() || !ready)}>{sending ? <Square size={14} /> : <Send size={16} />}</button></form>
        </section>

        <aside className="vibe-event-rail glass-panel"><header><div><p className="section-kicker">Agent telemetry</p><h3>Events</h3></div><span className={`stream-indicator ${streamState}`}><Radio size={12} />{streamState === "live" ? "LIVE" : streamState === "retrying" ? "RETRY" : "IDLE"}</span></header><div className="vibe-event-list">{events.map((event) => <article key={event.id} className={event.tone}><i /><span><strong>{event.label}</strong><small>{event.type}</small></span></article>)}{events.length === 0 && <div className="vibe-empty compact"><Activity size={22} /><span>The tools will appear here live.</span></div>}</div></aside>
      </div>}

      {tab === "skills" && <CatalogView query={query} setQuery={setQuery} count={filteredSkills.length}>{filteredSkills.map((skill) => <article className="vibe-catalog-card glass-panel" key={skill.name}><span><WandSparkles size={17} /></span><div><p className="section-kicker">Bundled skill</p><h3>{skill.name}</h3><p>{skill.description || "Vibe-Trading skill available for research."}</p></div><CheckCircle2 size={15} className="catalog-ready" /></article>)}</CatalogView>}
      {tab === "swarms" && <div className="vibe-real-grid">{presets.map((preset) => <article className="vibe-catalog-card swarm glass-panel" key={preset.name}><span><Network size={18} /></span><div><p className="section-kicker">{preset.agent_count} agents</p><h3>{preset.title || preset.name}</h3><p>{preset.description}</p><small>{preset.name}</small></div></article>)}{!loading && presets.length === 0 && <EmptyCatalog label="No presets exposed by Vibe." />}</div>}
      {tab === "runs" && <div className="vibe-real-grid">{runs.map((run, index) => <article className="vibe-catalog-card run glass-panel" key={run.id || run.run_id || index}><span><Database size={18} /></span><div><p className="section-kicker">{run.status || "artifact"}</p><h3>{run.title || run.id || run.run_id || "Vibe run"}</h3><p>{run.summary || "Persistent result available in Vibe runtime."}</p><small>{run.created_at ? new Date(run.created_at).toLocaleString("en-US") : ""}</small></div></article>)}{!loading && runs.length === 0 && <EmptyCatalog label="Runs and artifacts will appear after the first search." />}</div>}
    </section>
  </div>;
}

function StatusMetric({ label, value, live }: { label: string; value: string; live: boolean }) {
  return <div><span><i className={live ? "live" : ""} />{label}</span><strong>{value}</strong></div>;
}

function Tab({ id, tab, setTab, icon: Icon, label }: { id: VibeTab; tab: VibeTab; setTab: (tab: VibeTab) => void; icon: typeof Activity; label: string }) {
  return <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}><Icon size={15} />{label}</button>;
}

function CatalogView({ query, setQuery, count, children }: { query: string; setQuery: (value: string) => void; count: number; children: React.ReactNode }) {
  return <div><div className="vibe-catalog-toolbar glass-panel"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter the actual catalog…" /></label><span>{count} results</span></div><div className="vibe-real-grid">{children}</div></div>;
}

function EmptyCatalog({ label }: { label: string }) {
  return <div className="vibe-empty glass-panel"><Database size={25} /><span>{label}</span></div>;
}
