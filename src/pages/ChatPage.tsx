import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Bot, BrainCircuit, CheckCircle2, ChevronDown, Code2, Command, Database,
  GitBranch, Plus, Radio, Search, Send, ShieldCheck, SlidersHorizontal, StopCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { api } from "../lib/api";
import type { ChatMessage, Conversation } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";

type AgentKind = "pi" | "codex";
type ChatMode = "plan" | "build";

const config = {
  pi: { name: "Pi Core", short: "Pi", model: "PI CLI · lecture seule", description: "Orchestration et diagnostic du VPS" },
  codex: { name: "Codex", short: "Codex", model: "OpenAI Codex · sandbox systemd", description: "Planification et construction du dashboard" },
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function ChatPage({ agent }: { agent: AgentKind }) {
  const identity = config[agent];
  const navigate = useNavigate();
  const [mode, setMode] = useLocalStorage<ChatMode>("orbit-chat-mode-" + agent, agent === "pi" ? "plan" : "build");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contextOpen, setContextOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (id: string) => {
    if (!id) {
      setMessages([]);
      return;
    }
    const result = await api<{ ok: true; messages: ChatMessage[] }>(`/conversations/${id}/messages`);
    setMessages(result.messages);
  }, []);

  const loadConversations = useCallback(async (preferredId = "") => {
    const result = await api<{ ok: true; conversations: Conversation[] }>(`/conversations?agent=${agent}`);
    setConversations(result.conversations);
    const nextId = preferredId || result.conversations[0]?.id || "";
    setConversationId(nextId);
    await loadMessages(nextId);
  }, [agent, loadMessages]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadConversations().catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Impossible de charger les conversations");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadConversations]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const selectConversation = async (id: string) => {
    setConversationId(id);
    setError("");
    try {
      await loadMessages(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversation indisponible");
    }
  };

  const createConversation = async () => {
    setError("");
    try {
      const result = await api<{ ok: true; conversation: Conversation }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ agent, title: "Nouvelle conversation" }),
      });
      await loadConversations(result.conversation.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Création impossible");
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || thinking) return;
    const optimisticId = `pending-${Date.now()}`;
    setMessages((current) => [...current, {
      id: optimisticId,
      conversationId,
      role: "user",
      mode,
      content: value,
      createdAt: new Date().toISOString(),
    }]);
    setInput("");
    setThinking(true);
    setError("");
    try {
      const result = await api<{ ok: true; reply: string; conversationId: string; sessionReset?: boolean }>("/chat", {
        method: "POST",
        body: JSON.stringify({ agent, mode, message: value, conversationId: conversationId || undefined }),
      });
      await loadConversations(result.conversationId);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Erreur inconnue";
      setError(detail);
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        conversationId,
        role: "system",
        mode,
        content: `${identity.short} non joignable : ${detail}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setThinking(false);
    }
  };

  const activeConversation = conversations.find((item) => item.id === conversationId);
  const filteredConversations = conversations.filter((item) => item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return (
    <div className={`chat-page v03-chat agent-${agent}`}>
      <aside className="chat-history">
        <div className="chat-history-head"><div><p className="eyebrow"><span />{identity.short} sessions</p><h2>Conversations</h2></div><button className="button primary compact" onClick={createConversation} aria-label="Nouvelle conversation"><Plus size={14} /></button></div>
        <label className="small-search"><Search size={14} /><span className="sr-only">Rechercher</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher…" /></label>
        <div className="agent-space-switch">
          <button className={agent === "pi" ? "active pi" : ""} onClick={() => navigate("/chat/pi")}><Bot size={15} /><span><strong>Pi</strong><small>Orchestration</small></span></button>
          <button className={agent === "codex" ? "active codex" : ""} onClick={() => navigate("/chat/codex")}><Command size={15} /><span><strong>Codex</strong><small>Dashboard</small></span></button>
        </div>
        <div className="history-group"><small>{loading ? "Chargement…" : `${filteredConversations.length} conversation${filteredConversations.length > 1 ? "s" : ""}`}</small>{filteredConversations.map((item) => <button className={conversationId === item.id ? "active" : ""} onClick={() => selectConversation(item.id)} key={item.id}><strong>{item.title}</strong><span>{item.messageCount ?? 0} messages · {timeLabel(item.updatedAt)}</span></button>)}</div>
        {!loading && !filteredConversations.length && <div className="chat-empty-side"><Database size={16} /><span><strong>Aucune conversation</strong><small>Créez une session persistante pour commencer.</small></span></div>}
        <div className="chat-shared-note"><GitBranch size={14} /><span><strong>Persistance serveur</strong><small>Messages et reprises sont stockés dans SQLite.</small></span></div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-topbar">
          <div className="chat-agent">{agent === "pi" ? <Avatar name="Pi Core" color="cyan" /> : <span className="codex-avatar"><Command size={18} /></span>}<div><strong>{identity.name}</strong><span><i /> Passerelle sécurisée · {identity.model}</span></div></div>
          <div className="mode-tabs" role="tablist" aria-label="Mode de conversation"><button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")} role="tab" aria-selected={mode === "plan"}><BrainCircuit size={14} />Plan</button><button className={mode === "build" ? "active" : ""} onClick={() => setMode("build")} role="tab" aria-selected={mode === "build"}><Code2 size={14} />Build</button></div>
          <div className="chat-controls"><button className="model-select" onClick={() => setContextOpen(!contextOpen)}>État de session <ChevronDown size={14} /></button><button className="icon-button" disabled aria-label="Paramètres disponibles dans une phase ultérieure"><SlidersHorizontal size={17} /></button></div>
        </header>

        <div className="chat-mode-banner"><span className={mode}><i />Mode {mode === "plan" ? "Plan" : "Build"}</span><p>{mode === "plan" ? "Raisonner, explorer et proposer avant de modifier." : "Construire, modifier et vérifier dans le workspace partagé."}</p><em>{identity.description}</em></div>

        <div className="message-list" ref={listRef}>
          <div className="chat-date"><span>{activeConversation?.title || "Nouvelle conversation"}</span></div>
          {loading && <div className="chat-state"><Radio size={16} /><span>Synchronisation avec Orbit…</span></div>}
          {!loading && !messages.length && <div className="chat-state empty"><Database size={18} /><span><strong>Session prête</strong><small>Le premier message sera conservé côté serveur.</small></span></div>}
          {messages.map((message) => {
            const assistant = message.role !== "user";
            return <div className={`message-row ${assistant ? "assistant" : "user"} ${message.role === "system" ? "system" : ""}`} key={message.id}>
              {assistant && (agent === "pi" ? <Avatar name="Pi" color="cyan" size="sm" /> : <span className="codex-avatar small"><Command size={13} /></span>)}
              <div className="message-bubble"><div className="message-meta"><span>{message.role === "user" ? "Vous" : message.role === "system" ? "Orbit" : identity.name}</span><em>{message.mode}</em></div><p>{message.content}</p><small>{timeLabel(message.createdAt)}</small></div>
            </div>;
          })}
          {thinking && <div className="message-row assistant">{agent === "pi" ? <Avatar name="Pi" color="cyan" size="sm" /> : <span className="codex-avatar small"><Command size={13} /></span>}<div className="thinking-bubble"><span /><span /><span /></div></div>}
        </div>

        <form className="chat-composer" onSubmit={send}>
          <div className="composer-context"><span><ShieldCheck size={12} />{mode === "plan" ? "Planifier avec " : "Construire avec "}{identity.short}</span><span><Database size={12} />Conversation persistante</span></div>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={mode === "plan" ? "Décrivez ce que vous voulez comprendre ou planifier…" : "Décrivez ce que vous voulez construire ou modifier…"} rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <div className="composer-footer"><div className="composer-hint"><CheckCircle2 size={13} />Écriture durable</div><button className="send-button" type="submit" disabled={!input.trim() || thinking} aria-label="Envoyer">{thinking ? <StopCircle size={17} /> : <Send size={17} />}</button></div>
        </form>
        <p className="chat-disclaimer"><CheckCircle2 size={12} /> {agent === "pi" ? "PI connecté au VPS · lecture seule sécurisée." : mode === "plan" ? "Codex connecté · unité isolée en lecture seule." : "Codex connecté · écritures limitées au workspace."}</p>
      </section>

      {contextOpen && <aside className="chat-context-rail">
        <div className="context-rail-head"><p className="eyebrow"><span />Session state</p><h3>Données réelles</h3></div>
        <div className="context-meter"><span>Messages persistés</span><strong>{messages.filter((item) => !item.id.startsWith("pending-")).length}</strong><i><b style={{ width: messages.length ? "100%" : "0%" }} /></i><small>SQLite · reprise automatique</small></div>
        <div className="context-assets">
          <div className="context-fact"><Database size={15} /><span><strong>Conversation</strong><small>{activeConversation ? "Synchronisée" : "Créée au premier message"}</small></span><CheckCircle2 size={13} /></div>
          <div className="context-fact"><ShieldCheck size={15} /><span><strong>Isolation</strong><small>{agent === "pi" ? "Lecture seule" : mode === "plan" ? "Lecture seule" : "Workspace uniquement"}</small></span><CheckCircle2 size={13} /></div>
          <div className="context-fact"><Radio size={15} /><span><strong>Runtime</strong><small>Reprise gérée côté serveur</small></span><CheckCircle2 size={13} /></div>
        </div>
        {error && <div className="agent-handoff error"><Radio size={15} /><span><strong>Dernière erreur</strong><small>{error}</small></span></div>}
      </aside>}
    </div>
  );
}
