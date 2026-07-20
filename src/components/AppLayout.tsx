import { useEffect, useState } from "react";
import {
  Activity, Archive, Atom, Bot, Boxes, ChevronLeft, CircleDollarSign, Columns3,
  Command, Cpu, FileCode2, FlaskConical, FolderTree, Gauge, GitBranch, History, Inbox, Library, Menu,
  MessageSquareText, Moon, Network, Orbit, Search, Settings, Sparkles,
  Sun, TerminalSquare, Timer, WandSparkles, Workflow, X, Zap,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { api } from "../lib/api";
import type { SystemOverview } from "../types";

const navigation = [
  { group: "Flight deck", items: [
    { to: "/observatory", label: "Observatory", icon: Orbit },
    { to: "/chat/pi", label: "Pi Chat", icon: MessageSquareText, badge: "PI" },
    { to: "/chat/codex", label: "Codex Chat", icon: Command, badge: "CX" },
    { to: "/inbox", label: "Human Inbox", icon: Inbox },
  ]},
  { group: "Orchestration", items: [
    { to: "/agents", label: "Agents", icon: Bot },
    { to: "/runs", label: "Teams & Runs", icon: Workflow },
    { to: "/strategies", label: "Strategy Factory", icon: FlaskConical },
    { to: "/backtests", label: "Backtests", icon: Activity },
    { to: "/experiments", label: "Experiment Studio", icon: Sparkles },
    { to: "/compare", label: "Compare", icon: GitBranch },
    { to: "/correlation", label: "Correlation", icon: Network },
    { to: "/alpha-zoo", label: "Alpha Zoo", icon: Library },
    { to: "/skills", label: "Skills", icon: WandSparkles },
    { to: "/cron", label: "Cron Jobs", icon: Timer },
    { to: "/kanban", label: "Kanban", icon: Columns3 },
  ]},
  { group: "Workspace", items: [
    { to: "/knowledge", label: "Knowledge", icon: Atom },
    { to: "/files", label: "Files & Editor", icon: FolderTree },
    { to: "/artifacts", label: "Artifacts", icon: Archive },
    { to: "/memory", label: "Memory", icon: Cpu },
  ]},
  { group: "Systems", items: [
    { to: "/vibe", label: "Vibe-Trading", icon: Zap, badge: "LATER" },
    { to: "/trading", label: "Market Panel", icon: Activity, badge: "OFF" },
    { to: "/switchboard", label: "Switchboard", icon: Network },
    { to: "/control", label: "System", icon: Gauge },
    { to: "/activity", label: "Activity", icon: History },
    { to: "/usage", label: "Usage", icon: CircleDollarSign },
    { to: "/settings", label: "Settings", icon: Settings },
  ]},
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useLocalStorage<"dark" | "light">("pi-os-theme", "dark");
  const [motion] = useLocalStorage("orbit-motion", true);
  const [dense] = useLocalStorage("orbit-dense", false);
  const [system, setSystem] = useState<SystemOverview | null>(null);
  const [systemError, setSystemError] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const allItems = navigation.flatMap((section) => section.items);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "on" : "off";
    document.documentElement.dataset.density = dense ? "compact" : "comfortable";
  }, [motion, dense]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    let mounted = true;
    const refresh = () => api<SystemOverview>("/system/overview")
      .then((value) => { if (mounted) { setSystem(value); setSystemError(false); } })
      .catch(() => { if (mounted) setSystemError(true); });
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const go = (path: string) => {
    navigate(path);
    setPaletteOpen(false);
  };
  const serviceCount = system?.services.filter((service) => service.status === "operational" || service.status === "available").length;

  return (
    <div className={"app-shell v03-shell " + (collapsed ? "sidebar-collapsed" : "")}>
      <div className="space-scene" aria-hidden="true">
        <i className="stars stars-a" /><i className="stars stars-b" /><i className="stars stars-c" />
        <i className="space-horizon" /><i className="orbital-glow glow-a" /><i className="orbital-glow glow-b" />
        <i className="meteor meteor-one" /><i className="meteor meteor-two" />
      </div>
      <aside className={"sidebar " + (mobileOpen ? "mobile-open" : "")}>
        <div className="brand">
          <div className="brand-mark"><Orbit size={21} /><i /></div>
          <div className="brand-copy"><strong>ORBIT <span>/ OS</span></strong><small>Pi + Codex control plane</small></div>
          <button className="icon-button desktop-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} data-no-feedback="true"><ChevronLeft size={17} /></button>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          {navigation.map((section) => (
            <div className="nav-section" key={section.group}>
              <p className="nav-label">{section.group}</p>
              {section.items.map(({ to, label, icon: Icon, badge }) => (
                <NavLink key={to} to={to} className={({ isActive }) => "nav-link " + (isActive ? "active" : "")} title={collapsed ? label : undefined}>
                  <Icon size={17} /><span>{label}</span>{badge && <em>{badge}</em>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className={"demo-pulse system-pulse-button " + (!systemError && system ? "active" : "")} onClick={() => go("/control")}>
            <span className="pulse-dot" /><span><strong>{systemError ? "Degraded system" : system ? "Active control plane" : "Connecting…"}</strong><small>{system ? `${system.counts.events} persisted events` : "Synchronizing Orbit"}</small></span><Gauge size={14} />
          </button>
          <div className="profile-chip"><div className="profile-avatar">PB</div><div><strong>Paul's workspace</strong><small>V0.5 · Private VPS</small></div><Sparkles size={15} /></div>
        </div>
      </aside>

      <div className="workspace-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumbs"><Boxes size={15} /><span>Orbit OS</span><i>/</i><strong>{allItems.find((item) => item.to === location.pathname)?.label ?? "Observatory"}</strong></div>
          <button className="command-search" onClick={() => setPaletteOpen(true)}><Search size={15} /><span>Search, open or manage…</span><kbd>⌘ K</kbd></button>
          <button className={`system-chip ${systemError ? "degraded" : ""}`} onClick={() => go("/control")}><Network size={14} /><span>{system ? `${serviceCount}/${system.services.length} systems` : systemError ? "Degraded system" : "Connecting…"}</span><i /></button>
          <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Activate light lunar theme" : "Enable Dark Orbital Theme"} data-feedback={theme === "dark" ? "Lunar theme activated" : "Orbital theme activated"}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
        </header>
        <main className="main-content"><Outlet /></main>
      </div>

      {paletteOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPaletteOpen(false)}>
          <div className="command-palette v03-palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="palette-input"><Search size={18} /><input autoFocus placeholder="Order, file, agent or page…" /><kbd>ESC</kbd></div>
            <div className="palette-orbit"><span><Command size={13} />Universal command deck</span><small>Orbit navigation · bounded operations</small></div>
            <p className="palette-label">Quick actions</p>
            <div className="palette-results">
              <button onClick={() => go("/chat/codex")}><Command size={17} /><span><strong>Ask Codex to build</strong><small>Log in to Build mode</small></span><kbd>↵</kbd></button>
              <button onClick={() => go("/chat/pi")}><Bot size={17} /><span><strong>Plan with Pi</strong><small>Orchestrate the shared workspace</small></span></button>
              <button onClick={() => go("/control")}><TerminalSquare size={17} /><span><strong>Control services</strong><small>Visual Control Center</small></span></button>
              <button onClick={() => go("/vibe")}><Zap size={17} /><span><strong>Explore Vibe-Trading</strong><small>Docs, skills, agents and orders</small></span></button>
              <button onClick={() => go("/kanban")}><Columns3 size={17} /><span><strong>Create a mission</strong><small>Add a card to shared Kanban</small></span></button>
              <button onClick={() => go("/switchboard")}><GitBranch size={17} /><span><strong>Inspect connections</strong><small>View the System Switchboard</small></span></button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
