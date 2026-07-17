import { useEffect, useState } from "react";
import {
  Bot, Check, Command, Database, Globe2, KeyRound, MonitorCog, Moon, Save,
  ShieldCheck, Sparkles, Sun, WandSparkles,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type SettingsTab = "appearance" | "agents" | "data" | "connections" | "permissions";

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [theme, setTheme] = useLocalStorage<"dark" | "light">("pi-os-theme", "dark");
  const [accent, setAccent] = useLocalStorage("orbit-accent", "cyan");
  const [motion, setMotion] = useLocalStorage("orbit-motion", true);
  const [dense, setDense] = useLocalStorage("orbit-dense", false);
  const [voice, setVoice] = useLocalStorage("orbit-voice", true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset.motion = motion ? "on" : "off";
    document.documentElement.dataset.density = dense ? "compact" : "comfortable";
  }, [theme, motion, dense]);

  const nav = [
    { id: "appearance" as const, label: "Apparence", icon: MonitorCog },
    { id: "agents" as const, label: "Pi & Codex", icon: Bot },
    { id: "data" as const, label: "Data", icon: Database },
    { id: "connections" as const, label: "Connexions", icon: KeyRound },
    { id: "permissions" as const, label: "Permissions", icon: ShieldCheck },
  ];

  return <div className="page settings-page">
    <PageHeader eyebrow="System settings · V0.4" title="Orbit OS Settings" description="Personalize the overall experience, the two main runtimes and future connections from a single interface." />
    <div className="settings-layout reveal delay-1">
      <aside className="settings-nav">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</aside>
      <section className="settings-content glass-panel">
        {tab === "appearance" && <>
          <div className="settings-section"><div className="settings-heading"><span className="settings-icon">{theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}</span><div><h3>Space theme</h3><p>Two complete environments, designed to maintain the same identity.</p></div></div><div className="theme-choice-grid"><button className={"theme-card-v03 dark " + (theme === "dark" ? "selected" : "")} onClick={() => setTheme("dark")}><div className="theme-orbit-preview"><i /><span /><b /></div><span><strong>Orbital Night</strong><small>Deep blue · luminous glass</small></span>{theme === "dark" && <Check size={16} />}</button><button className={"theme-card-v03 light " + (theme === "light" ? "selected" : "")} onClick={() => setTheme("light")}><div className="theme-orbit-preview"><i /><span /><b /></div><span><strong>Lunar Daylight</strong><small>Lunar white · azure blue</small></span>{theme === "light" && <Check size={16} />}</button></div></div>
          <div className="settings-section"><div className="field-heading"><div><h4>Accent color</h4><p>Used for actions, statuses and main data.</p></div><div className="color-picker">{["cyan","violet","rose","amber"].map((color) => <button aria-label={color} className={"color-dot tone-" + color + " " + (accent === color ? "selected" : "")} key={color} onClick={() => setAccent(color)} />)}</div></div></div>
          <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><Sparkles size={18} /></span><div><h3>Movement and density</h3><p>Preferences are saved locally.</p></div></div><div className="setting-rows"><Setting title="Animations ambiantes" detail="Stars, transmissions and orbital signals." checked={motion} onChange={setMotion} /><Setting title="Interface dense" detail="Show more controls on each screen." checked={dense} onChange={setDense} /><Setting title="Simulated voice typing" detail="Enables microphone control in chats." checked={voice} onChange={setVoice} /></div></div>
        </>}

        {tab === "agents" && <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><Bot size={18} /></span><div><h3>Primary runtimes</h3><p>Pi and Codex share the same space without a parent/child relationship.</p></div></div><div className="runtime-setting-cards"><article><span className="tone-cyan"><Bot size={18} /></span><div><strong>Pi Core</strong><small>Orchestration · memory · delegation</small></div><em>PRIMARY</em><button className="button secondary compact">Configure</button></article><article><span className="tone-violet"><Command size={18} /></span><div><strong>Codex</strong><small>Plan · build · check</small></div><em>ALTERNATIVE</em><button className="button secondary compact">Configure</button></article></div><div className="shared-runtime-note"><WandSparkles size={16} /><span><strong>Shared pool</strong><small>3 sub-agents · 9 local skills · 142 files · 5 missions</small></span></div></div>}

        {tab === "data" && <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><Database size={18} /></span><div><h3>Local data</h3><p>Preview future storage controls.</p></div></div><div className="setting-rows"><Setting title="Workspace autosave" detail="Save Markdown changes on blur." checked onChange={() => undefined} /><Setting title="Automatic indexing" detail="Refresh the Knowledge Graph after modification." checked onChange={() => undefined} /><Setting title="30-day history" detail="Keep the local activity ledger." checked onChange={() => undefined} /></div><button className="button secondary"><Database size={14} />Open Database Studio</button></div>}

        {tab === "connections" && <div className="settings-section future-connections"><div className="settings-heading"><span className="settings-icon"><Globe2 size={18} /></span><div><h3>System Connections</h3><p>Planned locations, deliberately simulated in V0.4.</p></div></div><div className="connection-list"><div><span className="connection-logo">π</span><p><strong>Pi RPC</strong><small>localhost · standby</small></p><button className="button secondary compact">Test</button></div><div><span className="connection-logo vibe">C</span><p><strong>Codex Bridge</strong><small>ChatGPT OAuth · future</small></p><button className="button secondary compact">Configure</button></div><div><span className="connection-logo vibe">V</span><p><strong>Vibe-Trading MCP</strong><small>localhost:8899 · stopped</small></p><button className="button secondary compact">Connect</button></div><div><span className="connection-logo obs">O</span><p><strong>Obsidian Vault</strong><small>Local workspace · simulated</small></p><button className="button secondary compact">Choose</button></div></div></div>}

        {tab === "permissions" && <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><ShieldCheck size={18} /></span><div><h3>Permissions futures</h3><p>V0.4 displays controls but does not perform any actual system actions.</p></div></div><div className="permission-grid"><button><KeyRound size={16} /><span><strong>Filesystem global</strong><small>Future reading and writing</small></span><em>SIMULATED</em></button><button><Globe2 size={16} /><span><strong>Network access</strong><small>APIs and web search</small></span><em>SIMULATED</em></button><button><ShieldCheck size={16} /><span><strong>Action confirmation</strong><small>Requested before critical operation</small></span><em>ON</em></button></div></div>}

        <footer className="settings-footer"><span>{saved ? <><Check size={14} />Saved preferences</> : "The settings remain local to this V0.4."}</span><button className="button primary" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}><Save size={15} />Save</button></footer>
      </section>
    </div>
  </div>;
}

function Setting({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
