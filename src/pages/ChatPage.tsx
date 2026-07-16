import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bot, BrainCircuit, CheckCircle2, ChevronDown, Code2, Command, FileText, FolderTree,
  GitBranch, KanbanSquare, Mic, Paperclip, Plus, Radio, Search, Send,
  SlidersHorizontal, Sparkles, StopCircle, Users, WandSparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { useLocalStorage } from "../hooks/useLocalStorage";

type AgentKind = "pi" | "codex";
type ChatMode = "plan" | "build";
type Message = { id: number; role: "assistant" | "user"; text: string; time: string; mode?: ChatMode };

const initialPi: Message[] = [
  { id: 1, role: "assistant", text: "Bonjour Paul. Je vois le workspace partagé, les agents et les missions. Nous pouvons clarifier une direction, déléguer ou préparer un cycle.", time: "10:39", mode: "plan" },
  { id: 2, role: "user", text: "Quel est le meilleur prochain mouvement pour l’Agentic OS ?", time: "10:40" },
  { id: 3, role: "assistant", text: "Je stabiliserais d’abord le Control Plane partagé. Pi gardera l’orchestration, tandis que Codex pourra construire dans les mêmes fichiers avec le même contexte.", time: "10:40", mode: "plan" },
];
const initialCodex: Message[] = [
  { id: 1, role: "assistant", text: "Codex est prêt. J’ai accès au même workspace simulé, aux mêmes skills, au Kanban et aux mêmes sous-agents que Pi.", time: "10:41", mode: "build" },
  { id: 2, role: "user", text: "Inspecte la V0.4 et prépare une amélioration du frontend.", time: "10:42" },
  { id: 3, role: "assistant", text: "Build simulé terminé : shell orbital restructuré, thèmes synchronisés et nouvelles routes contrôlées. Les changements sont visibles dans le ledger partagé.", time: "10:42", mode: "build" },
];

const config = {
  pi: { name: "Pi Core", short: "Pi", tone: "cyan", model: "Pi orchestration runtime", description: "Orchestration, délégation et mémoire" },
  codex: { name: "Codex", short: "Codex", tone: "violet", model: "OpenAI Codex · Subscription", description: "Planification et construction du workspace" },
};

export function ChatPage({ agent }: { agent: AgentKind }) {
  const identity = config[agent];
  const navigate = useNavigate();
  const [messages, setMessages] = useLocalStorage<Message[]>("orbit-chat-" + agent, agent === "pi" ? initialPi : initialCodex);
  const [mode, setMode] = useLocalStorage<ChatMode>("orbit-chat-mode-" + agent, agent === "pi" ? "plan" : "build");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voice, setVoice] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [session, setSession] = useState("Architecture V0.4");
  const [agentSessionId, setAgentSessionId] = useLocalStorage<string>("orbit-agent-session-" + agent, "");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || thinking) return;
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: value, time: "maintenant", mode }]);
    setInput("");
    setThinking(true);

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, mode, message: value, sessionId: agentSessionId || undefined }),
      });
      const result = await response.json() as { ok?: boolean; reply?: string; error?: string; sessionId?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || `${identity.short} indisponible`);
      if (result.sessionId) setAgentSessionId(result.sessionId);
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: result.reply || "Réponse vide.", time: "maintenant", mode }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Erreur inconnue";
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: `${identity.short} non joignable : ${detail}`, time: "maintenant", mode }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className={"chat-page v03-chat agent-" + agent}>
      <aside className="chat-history">
        <div className="chat-history-head"><div><p className="eyebrow"><span />{identity.short} sessions</p><h2>Conversations</h2></div><button className="button primary compact" onClick={() => { setSession("Nouvelle conversation"); setAgentSessionId(""); setMessages([]); }} data-feedback="Nouvelle conversation créée"><Plus size={14} /></button></div>
        <label className="small-search"><Search size={14} /><span className="sr-only">Rechercher</span><input placeholder="Rechercher…" /></label>
        <div className="agent-space-switch">
          <button className={agent === "pi" ? "active pi" : ""} onClick={() => navigate("/chat/pi")}><Bot size={15} /><span><strong>Pi</strong><small>Orchestration</small></span></button>
          <button className={agent === "codex" ? "active codex" : ""} onClick={() => navigate("/chat/codex")}><Command size={15} /><span><strong>Codex</strong><small>Build</small></span></button>
        </div>
        <div className="history-group"><small>Aujourd'hui</small>{["Architecture V0.4", "Control plane partagé", "Workspace editor"].map((item, index) => <button className={session === item ? "active" : ""} onClick={() => setSession(item)} key={item}><strong>{item}</strong><span>{index === 0 ? "Il y a 2 min" : index === 1 ? "09:14" : "08:32"}</span></button>)}</div>
        <div className="chat-shared-note"><GitBranch size={14} /><span><strong>Même environnement</strong><small>Pi et Codex partagent fichiers, agents et mémoire.</small></span></div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-topbar">
          <div className="chat-agent">{agent === "pi" ? <Avatar name="Pi Core" color="cyan" /> : <span className="codex-avatar"><Command size={18} /></span>}<div><strong>{identity.name}</strong><span><i /> En ligne · {identity.model}</span></div></div>
          <div className="mode-tabs" role="tablist" aria-label="Mode de conversation"><button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")} role="tab" aria-selected={mode === "plan"}><BrainCircuit size={14} />Plan</button><button className={mode === "build" ? "active" : ""} onClick={() => setMode("build")} role="tab" aria-selected={mode === "build"}><Code2 size={14} />Build</button></div>
          <div className="chat-controls"><button className="model-select" onClick={() => setContextOpen(!contextOpen)}>Contexte partagé <ChevronDown size={14} /></button><button className="icon-button" aria-label="Paramètres de session"><SlidersHorizontal size={17} /></button></div>
        </header>

        <div className="chat-mode-banner"><span className={mode}><i />Mode {mode === "plan" ? "Plan" : "Build"}</span><p>{mode === "plan" ? "Raisonner, explorer et proposer avant de modifier." : "Construire, modifier et vérifier dans le workspace partagé."}</p><em>{identity.description}</em></div>

        <div className="message-list" ref={listRef}>
          <div className="chat-date"><span>{session} · Aujourd'hui</span></div>
          {messages.map((message) => (
            <div className={"message-row " + message.role} key={message.id}>
              {message.role === "assistant" && (agent === "pi" ? <Avatar name="Pi" color="cyan" size="sm" /> : <span className="codex-avatar small"><Command size={13} /></span>)}
              <div className="message-bubble"><div className="message-meta"><span>{message.role === "assistant" ? identity.name : "Vous"}</span>{message.mode && <em>{message.mode}</em>}</div><p>{message.text}</p><small>{message.time}</small></div>
            </div>
          ))}
          {thinking && <div className="message-row assistant">{agent === "pi" ? <Avatar name="Pi" color="cyan" size="sm" /> : <span className="codex-avatar small"><Command size={13} /></span>}<div className="thinking-bubble"><span /><span /><span /></div></div>}
        </div>

        <form className="chat-composer" onSubmit={send}>
          <div className="composer-context"><span><Sparkles size={12} />{mode === "plan" ? "Planifier avec " : "Construire avec "}{identity.short}</span><span><FolderTree size={12} />/Agentic OS</span></div>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={mode === "plan" ? "Décrivez ce que vous voulez comprendre ou planifier…" : "Décrivez ce que vous voulez construire ou modifier…"} rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <div className="composer-footer"><div><button type="button" className="icon-button" aria-label="Joindre un fichier"><Paperclip size={17} /></button><button type="button" className={"icon-button " + (voice ? "voice-active" : "")} onClick={() => setVoice(!voice)} aria-label={voice ? "Arrêter la saisie vocale" : "Activer la saisie vocale"}><Mic size={17} /></button></div><div className="composer-hint">{voice ? <><Radio size={13} />Écoute simulée…</> : <><WandSparkles size={13} />Contexte automatique</>}</div><button className="send-button" type="submit" aria-label="Envoyer">{thinking ? <StopCircle size={17} /> : <Send size={17} />}</button></div>
        </form>
        <p className="chat-disclaimer"><CheckCircle2 size={12} /> {agent === "pi" ? "PI connecté au VPS · lecture seule sécurisée." : mode === "plan" ? "Codex connecté · unité isolée en lecture seule." : "Codex connecté · écritures limitées au workspace."}</p>
      </section>

      {contextOpen && <aside className="chat-context-rail">
        <div className="context-rail-head"><p className="eyebrow"><span />Shared context</p><h3>Dans cette session</h3></div>
        <div className="context-meter"><span>Contexte chargé</span><strong>34%</strong><i><b /></i><small>43.5k / 128k tokens</small></div>
        <div className="context-assets">
          <button><FolderTree size={15} /><span><strong>Workspace</strong><small>142 fichiers</small></span><CheckCircle2 size={13} /></button>
          <button><Users size={15} /><span><strong>Sous-agents</strong><small>Atlas, Muse, Heron</small></span><CheckCircle2 size={13} /></button>
          <button><WandSparkles size={15} /><span><strong>Skills</strong><small>9 actifs</small></span><CheckCircle2 size={13} /></button>
          <button><KanbanSquare size={15} /><span><strong>Kanban</strong><small>4 missions</small></span><CheckCircle2 size={13} /></button>
          <button><FileText size={15} /><span><strong>Mémoire</strong><small>4 entrées épinglées</small></span><CheckCircle2 size={13} /></button>
        </div>
        <div className="agent-handoff"><Radio size={15} /><span><strong>Passage de relais</strong><small>Le contexte peut être transféré à {agent === "pi" ? "Codex" : "Pi"} sans perdre la session.</small></span><button className="button secondary compact" onClick={() => navigate(agent === "pi" ? "/chat/codex" : "/chat/pi")}>Transférer</button></div>
      </aside>}
    </div>
  );
}
