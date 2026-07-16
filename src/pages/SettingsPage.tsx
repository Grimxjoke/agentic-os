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
    { id: "data" as const, label: "Données", icon: Database },
    { id: "connections" as const, label: "Connexions", icon: KeyRound },
    { id: "permissions" as const, label: "Permissions", icon: ShieldCheck },
  ];

  return <div className="page settings-page">
    <PageHeader eyebrow="System settings · V0.4" title="Réglages Orbit OS" description="Personnalisez l’expérience globale, les deux runtimes principaux et les futures connexions depuis une interface unique." />
    <div className="settings-layout reveal delay-1">
      <aside className="settings-nav">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</aside>
      <section className="settings-content glass-panel">
        {tab === "appearance" && <>
          <div className="settings-section"><div className="settings-heading"><span className="settings-icon">{theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}</span><div><h3>Thème spatial</h3><p>Deux environnements complets, conçus pour conserver la même identité.</p></div></div><div className="theme-choice-grid"><button className={"theme-card-v03 dark " + (theme === "dark" ? "selected" : "")} onClick={() => setTheme("dark")}><div className="theme-orbit-preview"><i /><span /><b /></div><span><strong>Orbital Night</strong><small>Bleu profond · verre lumineux</small></span>{theme === "dark" && <Check size={16} />}</button><button className={"theme-card-v03 light " + (theme === "light" ? "selected" : "")} onClick={() => setTheme("light")}><div className="theme-orbit-preview"><i /><span /><b /></div><span><strong>Lunar Daylight</strong><small>Blanc lunaire · bleu azur</small></span>{theme === "light" && <Check size={16} />}</button></div></div>
          <div className="settings-section"><div className="field-heading"><div><h4>Couleur d'accent</h4><p>Utilisée pour les actions, statuts et données principales.</p></div><div className="color-picker">{["cyan","violet","rose","amber"].map((color) => <button aria-label={color} className={"color-dot tone-" + color + " " + (accent === color ? "selected" : "")} key={color} onClick={() => setAccent(color)} />)}</div></div></div>
          <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><Sparkles size={18} /></span><div><h3>Mouvement et densité</h3><p>Les préférences sont enregistrées localement.</p></div></div><div className="setting-rows"><Setting title="Animations ambiantes" detail="Étoiles, transmissions et signaux orbitaux." checked={motion} onChange={setMotion} /><Setting title="Interface dense" detail="Afficher plus de contrôles sur chaque écran." checked={dense} onChange={setDense} /><Setting title="Saisie vocale simulée" detail="Active le contrôle microphone dans les chats." checked={voice} onChange={setVoice} /></div></div>
        </>}

        {tab === "agents" && <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><Bot size={18} /></span><div><h3>Runtimes principaux</h3><p>Pi et Codex partagent le même espace sans relation parent/enfant.</p></div></div><div className="runtime-setting-cards"><article><span className="tone-cyan"><Bot size={18} /></span><div><strong>Pi Core</strong><small>Orchestration · mémoire · délégation</small></div><em>PRIMARY</em><button className="button secondary compact">Configurer</button></article><article><span className="tone-violet"><Command size={18} /></span><div><strong>Codex</strong><small>Plan · build · vérification</small></div><em>ALTERNATIVE</em><button className="button secondary compact">Configurer</button></article></div><div className="shared-runtime-note"><WandSparkles size={16} /><span><strong>Pool partagé</strong><small>3 sous-agents · 9 skills locaux · 142 fichiers · 5 missions</small></span></div></div>}

        {tab === "data" && <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><Database size={18} /></span><div><h3>Données locales</h3><p>Prévisualisation des futurs contrôles de stockage.</p></div></div><div className="setting-rows"><Setting title="Autosave Workspace" detail="Sauvegarder les modifications Markdown au blur." checked onChange={() => undefined} /><Setting title="Indexation automatique" detail="Actualiser le Knowledge Graph après modification." checked onChange={() => undefined} /><Setting title="Historique 30 jours" detail="Conserver le ledger d’activité local." checked onChange={() => undefined} /></div><button className="button secondary"><Database size={14} />Ouvrir Database Studio</button></div>}

        {tab === "connections" && <div className="settings-section future-connections"><div className="settings-heading"><span className="settings-icon"><Globe2 size={18} /></span><div><h3>Connexions système</h3><p>Emplacements prévus, volontairement simulés en V0.4.</p></div></div><div className="connection-list"><div><span className="connection-logo">π</span><p><strong>Pi RPC</strong><small>localhost · standby</small></p><button className="button secondary compact">Tester</button></div><div><span className="connection-logo vibe">C</span><p><strong>Codex Bridge</strong><small>ChatGPT OAuth · futur</small></p><button className="button secondary compact">Configurer</button></div><div><span className="connection-logo vibe">V</span><p><strong>Vibe-Trading MCP</strong><small>localhost:8899 · arrêté</small></p><button className="button secondary compact">Connecter</button></div><div><span className="connection-logo obs">O</span><p><strong>Obsidian Vault</strong><small>Workspace local · simulé</small></p><button className="button secondary compact">Choisir</button></div></div></div>}

        {tab === "permissions" && <div className="settings-section"><div className="settings-heading"><span className="settings-icon"><ShieldCheck size={18} /></span><div><h3>Permissions futures</h3><p>La V0.4 affiche les contrôles mais n’exécute aucune action système réelle.</p></div></div><div className="permission-grid"><button><KeyRound size={16} /><span><strong>Filesystem global</strong><small>Lecture et écriture futures</small></span><em>SIMULATED</em></button><button><Globe2 size={16} /><span><strong>Network access</strong><small>APIs et recherche Web</small></span><em>SIMULATED</em></button><button><ShieldCheck size={16} /><span><strong>Action confirmation</strong><small>Demandée avant opération critique</small></span><em>ON</em></button></div></div>}

        <footer className="settings-footer"><span>{saved ? <><Check size={14} />Préférences enregistrées</> : "Les réglages restent locaux à cette V0.4."}</span><button className="button primary" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}><Save size={15} />Enregistrer</button></footer>
      </section>
    </div>
  </div>;
}

function Setting({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
