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
  pi: { name: "Pi Core", short: "Pi", model: "PI CLI · read-only", description: "VPS orchestration and diagnostics" },
  codex: { name: "Codex", short: "Codex", model: "OpenAI Codex · sandbox systemd", description: "Planning and building the dashboard" },
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
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
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load conversations");
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
      setError(reason instanceof Error ? reason.message : "Conversation unavailable");
    }
  };

  const createConversation = async () => {
    setError("");
    try {
      const result = await api<{ ok: true; conversation: Conversation }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ agent, title: "New conversation" }),
      });
      await loadConversations(result.conversation.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create");
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
      const detail = reason instanceof Error ? reason.message : "Unknown error";
      setError(detail);
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        conversationId,
        role: "system",
        mode,
        content: `${identity.short} unavailable: ${detail}`,
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
        <div className="chat-history-head"><div><p className="eyebrow"><span />{identity.short} sessions</p><h2>Conversations</h2></div><button className="button primary compact" onClick={createConversation} aria-label="New conversation"><Plus size={14} /></button></div>
        <label className="small-search"><Search size={14} /><span className="sr-only">Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" /></label>
        <div className="agent-space-switch">
          <button className={agent === "pi" ? "active pi" : ""} onClick={() => navigate("/chat/pi")}><Bot size={15} /><span><strong>Pi</strong><small>Orchestration</small></span></button>
          <button className={agent === "codex" ? "active codex" : ""} onClick={() => navigate("/chat/codex")}><Command size={15} /><span><strong>Codex</strong><small>Dashboard</small></span></button>
        </div>
        <div className="history-group"><small>{loading ? "Loading…" : `${filteredConversations.length} conversation${filteredConversations.length > 1 ? "s" : ""}`}</small>{filteredConversations.map((item) => <button className={conversationId === item.id ? "active" : ""} onClick={() => selectConversation(item.id)} key={item.id}><strong>{item.title}</strong><span>{item.messageCount ?? 0} messages · {timeLabel(item.updatedAt)}</span></button>)}</div>
        {!loading && !filteredConversations.length && <div className="chat-empty-side"><Database size={16} /><span><strong>No conversation</strong><small>Create a persistent session to get started.</small></span></div>}
        <div className="chat-shared-note"><GitBranch size={14} /><span><strong>Persistance serveur</strong><small>Messages and resumes are stored in SQLite.</small></span></div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-topbar">
          <div className="chat-agent">{agent === "pi" ? <Avatar name="Pi Core" color="cyan" /> : <span className="codex-avatar"><Command size={18} /></span>}<div><strong>{identity.name}</strong><span><i /> Secure gateway ·{identity.model}</span></div></div>
          <div className="mode-tabs" role="tablist" aria-label="Mode de conversation"><button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")} role="tab" aria-selected={mode === "plan"}><BrainCircuit size={14} />Plan</button><button className={mode === "build" ? "active" : ""} onClick={() => setMode("build")} role="tab" aria-selected={mode === "build"}><Code2 size={14} />Build</button></div>
          <div className="chat-controls"><button className="model-select" onClick={() => setContextOpen(!contextOpen)}>Session State<ChevronDown size={14} /></button><button className="icon-button" disabled aria-label="Settings available in a later phase"><SlidersHorizontal size={17} /></button></div>
        </header>

        <div className="chat-mode-banner"><span className={mode}><i />Mode {mode === "plan" ? "Plan" : "Build"}</span><p>{mode === "plan" ? "Reason, explore and propose before modifying." : "Build, modify and verify in the shared workspace."}</p><em>{identity.description}</em></div>

        <div className="message-list" ref={listRef}>
          <div className="chat-date"><span>{activeConversation?.title || "New conversation"}</span></div>
          {loading && <div className="chat-state"><Radio size={16} /><span>Synchronization with Orbit…</span></div>}
          {!loading && !messages.length && <div className="chat-state empty"><Database size={18} /><span><strong>Session ready</strong><small>The first message will be kept on the server side.</small></span></div>}
          {messages.map((message) => {
            const assistant = message.role !== "user";
            return <div className={`message-row ${assistant ? "assistant" : "user"} ${message.role === "system" ? "system" : ""}`} key={message.id}>
              {assistant && (agent === "pi" ? <Avatar name="Pi" color="cyan" size="sm" /> : <span className="codex-avatar small"><Command size={13} /></span>)}
              <div className="message-bubble"><div className="message-meta"><span>{message.role === "user" ? "You" : message.role === "system" ? "Orbit" : identity.name}</span><em>{message.mode}</em></div><p>{message.content}</p><small>{timeLabel(message.createdAt)}</small></div>
            </div>;
          })}
          {thinking && <div className="message-row assistant">{agent === "pi" ? <Avatar name="Pi" color="cyan" size="sm" /> : <span className="codex-avatar small"><Command size={13} /></span>}<div className="thinking-bubble"><span /><span /><span /></div></div>}
        </div>

        <form className="chat-composer" onSubmit={send}>
          <div className="composer-context"><span><ShieldCheck size={12} />{mode === "plan" ? "Plan with " : "Build with "}{identity.short}</span><span><Database size={12} />Persistent conversation</span></div>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={mode === "plan" ? "Describe what you want to understand or plan…" : "Describe what you want to build or modify…"} rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <div className="composer-footer"><div className="composer-hint"><CheckCircle2 size={13} />Sustainable writing</div><button className="send-button" type="submit" disabled={!input.trim() || thinking} aria-label="Envoyer">{thinking ? <StopCircle size={17} /> : <Send size={17} />}</button></div>
        </form>
        <p className="chat-disclaimer"><CheckCircle2 size={12} /> {agent === "pi" ? "PI connected to VPS · secure read-only." : mode === "plan" ? "Connected codex · read-only isolated unit." : "Connected codex · writings limited to the workspace."}</p>
      </section>

      {contextOpen && <aside className="chat-context-rail">
        <div className="context-rail-head"><p className="eyebrow"><span />Session state</p><h3>Actual data</h3></div>
        <div className="context-meter"><span>Persistent messages</span><strong>{messages.filter((item) => !item.id.startsWith("pending-")).length}</strong><i><b style={{ width: messages.length ? "100%" : "0%" }} /></i><small>SQLite · automatic recovery</small></div>
        <div className="context-assets">
          <div className="context-fact"><Database size={15} /><span><strong>Conversation</strong><small>{activeConversation ? "Synchronized" : "Created on first message"}</small></span><CheckCircle2 size={13} /></div>
          <div className="context-fact"><ShieldCheck size={15} /><span><strong>Isolation</strong><small>{agent === "pi" ? "Read only" : mode === "plan" ? "Read only" : "Workspace uniquement"}</small></span><CheckCircle2 size={13} /></div>
          <div className="context-fact"><Radio size={15} /><span><strong>Runtime</strong><small>Server-side managed recovery</small></span><CheckCircle2 size={13} /></div>
        </div>
        {error && <div className="agent-handoff error"><Radio size={15} /><span><strong>Last error</strong><small>{error}</small></span></div>}
      </aside>}
    </div>
  );
}
