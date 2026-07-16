import { FormEvent, useState } from "react";
import {
  Activity, BarChart3, BookOpen, Bot, Boxes, BrainCircuit, CheckCircle2, ChevronRight,
  Clipboard, Code2, Database, ExternalLink, FileCode2, GitBranch, Globe2, Layers3,
  MessageSquareText, Network, Play, Search, Send, ShieldCheck, Sparkles, TerminalSquare,
  TrendingUp, Users, WandSparkles, Zap,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type VibeTab = "cockpit" | "docs" | "skills" | "agents" | "commands" | "chat";
type VibeMessage = { id: number; role: "assistant" | "user"; text: string };

const tabs = [
  { id: "cockpit" as const, label: "Cockpit", icon: Activity },
  { id: "docs" as const, label: "Docs", icon: BookOpen },
  { id: "skills" as const, label: "77 Skills", icon: WandSparkles },
  { id: "agents" as const, label: "29 Swarms", icon: Users },
  { id: "commands" as const, label: "Commandes", icon: TerminalSquare },
  { id: "chat" as const, label: "Repo Chat", icon: MessageSquareText },
];

const skillGroups = [
  { category: "Data Source", count: 7, icon: Database, skills: ["data-routing", "yfinance", "okx-market", "akshare", "mootdx", "ccxt"] },
  { category: "Strategy", count: 17, icon: GitBranch, skills: ["strategy-generate", "multi-factor", "ml-strategy", "ichimoku", "smc", "cross-market"] },
  { category: "Analysis", count: 17, icon: BarChart3, skills: ["factor-research", "global-macro", "valuation-model", "earnings-forecast", "dividend-analysis"] },
  { category: "Asset Class", count: 9, icon: Layers3, skills: ["options-strategy", "convertible-bond", "etf-analysis", "asset-allocation", "sector-rotation"] },
  { category: "Risk & Delivery", count: 27, icon: ShieldCheck, skills: ["risk-analysis", "backtest-report", "pine-export", "trade-journal", "shadow-account"] },
];

const commands = [
  { command: "vibe-trading", description: "Ouvrir le terminal interactif", group: "Core" },
  { command: "vibe-trading run -p \"Analyze AAPL momentum\"", description: "Lancer une recherche en langage naturel", group: "Core" },
  { command: "vibe-trading serve --port 8899", description: "Démarrer le serveur FastAPI et Web", group: "Service" },
  { command: "vibe-trading-mcp", description: "Exposer les 22 outils MCP", group: "Service" },
  { command: "/skills", description: "Lister les skills finance", group: "TUI" },
  { command: "/swarm run investment_committee", description: "Lancer une équipe multi-agent", group: "TUI" },
  { command: "/trace <run_id>", description: "Rejouer une exécution complète", group: "TUI" },
  { command: "vibe-trading alpha list", description: "Explorer les 452 alphas intégrés", group: "Alpha Zoo" },
  { command: "vibe-trading alpha bench --zoo gtja191", description: "Benchmarker un zoo d’alphas", group: "Alpha Zoo" },
];

const swarms = [
  { name: "Investment Committee", agents: "Analyst · Risk · Macro · Chair", purpose: "Décision contradictoire et synthèse d’investissement", tone: "cyan" },
  { name: "Quant Research Team", agents: "Data · Factor · Backtest · Reviewer", purpose: "Hypothèse quantitative, validation et robustesse", tone: "violet" },
  { name: "Crypto Intelligence", agents: "On-chain · Technical · Risk · Scout", purpose: "Recherche crypto multi-source et analyse de régime", tone: "rose" },
  { name: "Global Macro Desk", agents: "Macro · Rates · FX · Commodities", purpose: "Scénarios cross-market et transmission du risque", tone: "amber" },
];

const initialChat: VibeMessage[] = [
  { id: 1, role: "assistant", text: "Je suis le guide Vibe-Trading isolé. Mon contexte simulé couvre l’architecture du dépôt, les skills, les swarms, les commandes CLI/MCP et les workflows de recherche." },
];

export function VibePage() {
  const [tab, setTab] = useState<VibeTab>("cockpit");
  const [skillQuery, setSkillQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("strategy-generate");
  const [messages, setMessages] = useLocalStorage<VibeMessage[]>("orbit-vibe-chat", initialChat);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || thinking) return;
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: value }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      const lower = value.toLowerCase();
      const text = lower.includes("skill")
        ? "Le dépôt organise 77 skills en huit familles. Pour démarrer, chargez strategy-generate pour produire une hypothèse, puis backtest et risk-analysis pour la valider."
        : lower.includes("mcp")
          ? "Vibe-Trading expose 22 outils MCP, notamment list_skills, load_skill, backtest, get_market_data, run_swarm, get_run_result et list_runs."
          : lower.includes("agent") || lower.includes("swarm")
            ? "Les 29 presets swarm assemblent des spécialistes par objectif. Investment Committee est adapté aux décisions contradictoires ; Quant Research Team convient à la validation factorielle."
            : lower.includes("install") || lower.includes("command")
              ? "Le chemin local recommandé commence par pip install vibe-trading-ai, puis vibe-trading init. Le serveur Web peut être lancé avec vibe-trading serve --port 8899."
              : "Dans cette V0.4, je réponds depuis un index documentaire simulé du dépôt Vibe-Trading. Je peux expliquer son architecture, ses commandes, ses skills, ses swarms et ses sorties de recherche.";
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text }]);
      setThinking(false);
    }, 850);
  };

  return <div className="page vibe-page">
    <PageHeader eyebrow="Specialized research system" title="Vibe-Trading Cockpit" description="Comprendre, configurer et interroger Vibe-Trading sans mémoriser sa surface CLI. Le moteur de trading reste déconnecté." actions={<><span className="simulation-badge"><Zap size={13} />Repo context · simulated</span><a className="button secondary" href="https://github.com/HKUDS/Vibe-Trading" target="_blank" rel="noreferrer"><ExternalLink size={14} />Dépôt officiel</a></>} />

    <div className="vibe-statline reveal delay-1">
      <div><strong>77</strong><span>Skills finance</span></div><div><strong>29</strong><span>Swarms</span></div><div><strong>22</strong><span>Outils MCP</span></div><div><strong>452</strong><span>Alphas</span></div><div><strong>7</strong><span>Backtest engines</span></div>
    </div>

    <div className="vibe-tabs reveal delay-2" role="tablist">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}><Icon size={15} />{label}</button>)}</div>

    <section className="vibe-content reveal delay-3">
      {tab === "cockpit" && <Cockpit onNavigate={setTab} />}
      {tab === "docs" && <Docs />}
      {tab === "skills" && <div className="vibe-skills-layout"><aside className="vibe-skill-groups glass-panel"><label><Search size={14} /><input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Filtrer les skills…" /></label>{skillGroups.map((group) => { const Icon = group.icon; const visible = group.skills.filter((skill) => skill.includes(skillQuery.toLowerCase())); return <section key={group.category}><header><Icon size={14} /><strong>{group.category}</strong><span>{group.count}</span></header>{visible.map((skill) => <button className={selectedSkill === skill ? "active" : ""} key={skill} onClick={() => setSelectedSkill(skill)}><span>{skill}</span><ChevronRight size={13} /></button>)}</section>; })}</aside><SkillInspector skill={selectedSkill} /></div>}
      {tab === "agents" && <div className="swarm-grid">{swarms.map((swarm) => <article className="glass-panel swarm-card" key={swarm.name}><span className={"swarm-sigil tone-" + swarm.tone}><Network size={19} /></span><p className="section-kicker">Preset swarm</p><h3>{swarm.name}</h3><p>{swarm.purpose}</p><div className="swarm-agent-line"><Users size={13} />{swarm.agents}</div><footer><button className="button secondary compact"><Boxes size={13} />Inspecter</button><button className="button primary compact"><Play size={13} />Simuler</button></footer></article>)}</div>}
      {tab === "commands" && <div className="command-catalog glass-panel"><header><div><p className="section-kicker">CLI translated to UI</p><h3>Commandes disponibles</h3></div><span>Chaque commande deviendra progressivement une action visuelle.</span></header>{commands.map((item) => <article key={item.command}><span>{item.group}</span><code>{item.command}</code><p>{item.description}</p><button className="icon-button" aria-label={"Copier " + item.command} onClick={() => navigator.clipboard?.writeText(item.command)}><Clipboard size={14} /></button><button className="button secondary compact"><Play size={12} />Simuler</button></article>)}</div>}
      {tab === "chat" && <div className="vibe-chat-layout"><aside className="repo-context glass-panel"><span className="repo-logo"><GitBranch size={22} /></span><h3>HKUDS/Vibe-Trading</h3><p>Contexte spécialisé et isolé du reste du dashboard.</p><div><span><CheckCircle2 size={13} />README et guides</span><span><CheckCircle2 size={13} />Skills registry</span><span><CheckCircle2 size={13} />CLI & MCP surface</span><span><CheckCircle2 size={13} />Architecture agent</span></div><small>Snapshot documentaire simulé · aucune donnée de marché</small></aside><section className="repo-chat glass-panel"><header><div><BrainCircuit size={17} /><span><strong>Vibe Repository Guide</strong><small>Contexte : repo uniquement</small></span></div><em><i />Ready</em></header><div className="repo-message-list">{messages.map((message) => <div className={"repo-message " + message.role} key={message.id}>{message.role === "assistant" && <Bot size={15} />}<p>{message.text}</p></div>)}{thinking && <div className="repo-message assistant"><Bot size={15} /><p>Inspection du contexte…</p></div>}</div><form onSubmit={ask}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Posez une question uniquement sur Vibe-Trading…" /><button className="send-button" aria-label="Envoyer au guide Vibe-Trading"><Send size={16} /></button></form></section></div>}
    </section>
  </div>;
}

function Cockpit({ onNavigate }: { onNavigate: (tab: VibeTab) => void }) {
  return <div className="vibe-cockpit">
    <article className="vibe-architecture glass-panel"><header><div><p className="section-kicker">System map</p><h3>Du langage naturel à la recherche vérifiable</h3></div><button className="button secondary compact" onClick={() => onNavigate("docs")}>Lire le guide <ChevronRight size={13} /></button></header><div className="vibe-flow"><FlowNode icon={MessageSquareText} label="Question" detail="Prompt naturel" tone="cyan" /><ChevronRight /><FlowNode icon={BrainCircuit} label="ReAct Agent" detail="Plan + outils" tone="violet" /><ChevronRight /><FlowNode icon={Database} label="Market Data" detail="Fallback multi-source" tone="rose" /><ChevronRight /><FlowNode icon={BarChart3} label="Backtest" detail="7 engines" tone="amber" /><ChevronRight /><FlowNode icon={FileCode2} label="Artifact" detail="Rapport + code" tone="cyan" /></div></article>
    <div className="vibe-capability-grid"><Capability icon={Globe2} title="Cross-market" text="Actions A/HK/US, crypto, futures et forex." /><Capability icon={Users} title="Multi-agent" text="29 équipes prêtes pour recherche, quant et risque." /><Capability icon={TrendingUp} title="Alpha Zoo" text="452 alphas inspectables, comparables et exportables." /><Capability icon={ShieldCheck} title="Research first" text="Simulation et backtesting, sans exécution live." /></div>
    <article className="vibe-next glass-panel"><span className="vibe-next-icon"><Sparkles size={20} /></span><div><p className="section-kicker">Recommended starting path</p><h3>Question → Skill → Backtest → Review</h3><p>Utilisez le Repo Chat pour choisir un skill, puis simulez un run avant la future connexion backend.</p></div><button className="button primary" onClick={() => onNavigate("chat")}>Interroger le repo</button></article>
  </div>;
}

function Docs() {
  const sections = [
    { icon: Zap, title: "Ce que fait Vibe-Trading", text: "Transforme une question financière en recherche outillée, données, backtests, rapports, code et mémoire persistante." },
    { icon: BrainCircuit, title: "Agent Harness", text: "Un agent ReAct charge les skills nécessaires, appelle les outils, compresse le contexte et conserve les runs." },
    { icon: Database, title: "Données", text: "Les loaders sélectionnent automatiquement une source compatible avec le marché et utilisent des fallbacks lorsque nécessaire." },
    { icon: Network, title: "Swarms", text: "Les presets assemblent plusieurs rôles spécialisés qui débattent, testent et synthétisent une réponse." },
    { icon: Code2, title: "Sorties", text: "Rapports, métriques, stratégie générée, TradingView Pine Script, exports et traces d’exécution." },
    { icon: ShieldCheck, title: "Frontière", text: "Le projet est orienté recherche, simulation et backtesting. Cette V0.4 ne déclenche aucun ordre réel." },
  ];
  return <div className="docs-grid">{sections.map(({ icon: Icon, title, text }, index) => <article className="glass-panel doc-card" key={title}><span>0{index + 1}</span><Icon size={19} /><h3>{title}</h3><p>{text}</p><button className="text-button">Explorer <ChevronRight size={13} /></button></article>)}</div>;
}

function SkillInspector({ skill }: { skill: string }) {
  return <article className="skill-inspector glass-panel"><header><span className="skill-inspector-icon"><WandSparkles size={21} /></span><div><p className="eyebrow"><span />Bundled finance skill</p><h2>{skill}</h2></div><em>READY</em></header><div className="skill-inspector-body"><section><p className="detail-label">Mission</p><p>Charge les instructions spécialisées de <strong>{skill}</strong>, sélectionne les outils nécessaires et structure une sortie vérifiable.</p></section><section><p className="detail-label">Pipeline attendu</p><div className="mini-pipeline"><span><i />Load context</span><span><i />Fetch data</span><span><i />Run analysis</span><span><i />Validate output</span></div></section><section><p className="detail-label">Disponible pour</p><div className="tool-tags"><span>Pi</span><span>Codex</span><span>Heron</span><span>Vibe Agent</span></div></section></div><footer><button className="button secondary"><BookOpen size={14} />Voir SKILL.md</button><button className="button primary"><Play size={14} />Tester en sandbox</button></footer></article>;
}

function FlowNode({ icon: Icon, label, detail, tone }: { icon: typeof Zap; label: string; detail: string; tone: string }) {
  return <div className={"vibe-flow-node tone-" + tone}><Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span></div>;
}
function Capability({ icon: Icon, title, text }: { icon: typeof Zap; title: string; text: string }) {
  return <article><Icon size={18} /><h3>{title}</h3><p>{text}</p></article>;
}
