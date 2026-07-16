import { FormEvent, useState } from "react";
import {
  Bot, Braces, CheckCircle2, Code2, Database, FileSearch, MoreHorizontal,
  Pencil, Play, Plus, Search, ShieldCheck, Sparkles, WandSparkles, X,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type Skill = {
  id: string; name: string; description: string; category: string; version: string;
  instructions: string; agents: string[]; executions: number; icon: string; enabled: boolean;
};

const seedSkills: Skill[] = [
  { id: "workspace-reader", name: "Workspace Reader", description: "Lit, recherche et synthétise les fichiers du workspace.", category: "Knowledge", version: "1.2.0", instructions: "Inspecter les fichiers pertinents, citer les chemins et préserver la structure existante.", agents: ["Pi Core", "Atlas"], executions: 142, icon: "files", enabled: true },
  { id: "architecture-map", name: "Architecture Map", description: "Transforme un projet en carte de composants et dépendances.", category: "Engineering", version: "0.8.4", instructions: "Identifier les frontières, les flux de données, les dépendances et les zones de risque.", agents: ["Atlas"], executions: 28, icon: "code", enabled: true },
  { id: "visual-design", name: "Visual Direction", description: "Produit une direction visuelle cohérente et réutilisable.", category: "Creative", version: "1.0.1", instructions: "Respecter les tokens, la hiérarchie et les interactions existantes.", agents: ["Muse"], executions: 19, icon: "sparkles", enabled: true },
  { id: "research-brief", name: "Research Brief", description: "Condense plusieurs sources dans un brief actionnable.", category: "Research", version: "1.4.2", instructions: "Séparer faits, inférences, inconnues et prochaine meilleure action.", agents: ["Pi Core", "Heron"], executions: 67, icon: "search", enabled: true },
  { id: "risk-review", name: "Risk Review", description: "Vérifie hypothèses, limites et conséquences avant exécution.", category: "Governance", version: "0.6.0", instructions: "Chercher les risques silencieux, les dépendances implicites et les actions irréversibles.", agents: ["Pi Core"], executions: 12, icon: "shield", enabled: true },
  { id: "data-inspector", name: "Data Inspector", description: "Analyse schémas, tables et qualité des données simulées.", category: "Data", version: "0.4.3", instructions: "Profiler les données sans les modifier et signaler les incohérences.", agents: ["Heron"], executions: 9, icon: "database", enabled: false },
];

const iconMap = { files: FileSearch, code: Code2, sparkles: Sparkles, search: Search, shield: ShieldCheck, database: Database };

export function SkillsPage() {
  const [skills, setSkills] = useLocalStorage<Skill[]>("pi-os-skills", seedSkills);
  const [selectedId, setSelectedId] = useState(skills[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testDone, setTestDone] = useState(false);
  const selected = skills.find((skill) => skill.id === selectedId) ?? skills[0];

  const runTest = () => {
    setTesting(true); setTestDone(false);
    window.setTimeout(() => { setTesting(false); setTestDone(true); }, 900);
  };
  const save = (skill: Skill) => {
    setSkills((current) => current.some((item) => item.id === skill.id) ? current.map((item) => item.id === skill.id ? skill : item) : [...current, skill]);
    setSelectedId(skill.id); setEditing(false);
  };

  return (
    <div className="page skills-page">
      <PageHeader eyebrow="Capability registry" title="Skills" description="Les capacités réutilisables de votre système, documentées, testables et attribuées aux bons agents." actions={<button className="button primary" onClick={() => { setSelectedId(""); setEditing(true); }}><Plus size={15} />Créer un skill</button>} />
      <section className="skills-summary reveal delay-1">
        <div><strong>{skills.length.toString().padStart(2, "0")}</strong><span>Skills installés</span></div>
        <div><strong>{skills.filter((skill) => skill.enabled).length.toString().padStart(2, "0")}</strong><span>Actifs</span></div>
        <div><strong>{skills.reduce((sum, skill) => sum + skill.executions, 0)}</strong><span>Exécutions</span></div>
        <div><strong>04</strong><span>Agents équipés</span></div>
      </section>
      <div className="skills-layout reveal delay-2">
        <aside className="skills-library glass-panel">
          <div className="directory-tools"><label><Search size={15} /><input placeholder="Rechercher un skill…" /></label><button className="icon-button"><MoreHorizontal size={16} /></button></div>
          <div className="skill-list">
            {skills.map((skill) => {
              const Icon = iconMap[skill.icon as keyof typeof iconMap] ?? WandSparkles;
              return <button key={skill.id} className={selected?.id === skill.id ? "selected" : ""} onClick={() => { setSelectedId(skill.id); setEditing(false); setTestDone(false); }}>
                <span className="skill-icon"><Icon size={17} /></span>
                <span><strong>{skill.name}</strong><small>{skill.category} · v{skill.version}</small></span>
                <i className={skill.enabled ? "enabled" : ""} />
              </button>;
            })}
          </div>
        </aside>
        {editing ? <SkillEditor skill={selectedId ? selected : undefined} onCancel={() => { setEditing(false); if (!selectedId) setSelectedId(skills[0]?.id ?? ""); }} onSave={save} /> : selected && (
          <section className="skill-detail glass-panel">
            <header><div className="skill-hero-icon"><WandSparkles size={24} /></div><div><p className="eyebrow"><span />{selected.category}</p><h2>{selected.name}</h2><p>{selected.description}</p></div><button className="button secondary compact" onClick={() => setEditing(true)}><Pencil size={13} />Modifier</button></header>
            <div className="skill-detail-body">
              <div className="skill-main">
                <section><p className="detail-label">Instructions</p><div className="prompt-preview">{selected.instructions}</div></section>
                <section><p className="detail-label">Agents équipés</p><div className="skill-agents">{selected.agents.map((agent) => <span key={agent}><Avatar name={agent} color={agent === "Atlas" ? "violet" : agent === "Muse" ? "rose" : agent === "Heron" ? "amber" : "cyan"} size="sm" />{agent}</span>)}</div></section>
                <section className="skill-test-zone"><div><p className="detail-label">Test sandbox</p><h3>Valider le comportement</h3><p>Exécute une vérification simulée sans modifier le workspace.</p></div><button className="button primary" onClick={runTest} disabled={testing}><Play size={14} />{testing ? "Test en cours…" : "Tester le skill"}</button></section>
                {testDone && <div className="skill-test-result"><CheckCircle2 size={16} /><span><strong>Test réussi en 842 ms</strong><small>Entrées validées · sortie structurée · aucun effet de bord</small></span></div>}
              </div>
              <aside className="skill-meta">
                <div><span>Version</span><strong>{selected.version}</strong></div>
                <div><span>Exécutions</span><strong>{selected.executions}</strong></div>
                <div><span>Statut</span><strong className={selected.enabled ? "positive" : ""}>{selected.enabled ? "Actif" : "Désactivé"}</strong></div>
                <div><span>Format</span><strong><Braces size={13} />SKILL.md</strong></div>
              </aside>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SkillEditor({ skill, onCancel, onSave }: { skill?: Skill; onCancel: () => void; onSave: (skill: Skill) => void }) {
  const [draft, setDraft] = useState<Skill>(skill ?? { id: "skill-" + Date.now(), name: "", description: "", category: "Knowledge", version: "0.1.0", instructions: "", agents: ["Pi Core"], executions: 0, icon: "sparkles", enabled: true });
  const submit = (event: FormEvent) => { event.preventDefault(); if (draft.name.trim()) onSave(draft); };
  return <form className="skill-editor glass-panel" onSubmit={submit}>
    <header><div><p className="eyebrow"><span />Skill builder</p><h2>{skill ? "Modifier le skill" : "Nouveau skill"}</h2></div><button type="button" className="icon-button" onClick={onCancel}><X size={18} /></button></header>
    <div className="editor-scroll">
      <div className="form-grid"><label><span>Nom</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex. Document Publisher" /></label><label><span>Catégorie</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>Knowledge</option><option>Engineering</option><option>Creative</option><option>Research</option><option>Data</option><option>Governance</option></select></label></div>
      <label><span>Description</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label><span>Instructions</span><textarea rows={8} className="mono-input" value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Décrivez le comportement, les entrées, les sorties et les limites…" /></label>
      <fieldset><legend>Agents autorisés</legend><div className="tools-check-grid">{["Pi Core", "Atlas", "Muse", "Heron"].map((agent) => <label key={agent}><input type="checkbox" checked={draft.agents.includes(agent)} onChange={() => setDraft({ ...draft, agents: draft.agents.includes(agent) ? draft.agents.filter((item) => item !== agent) : [...draft.agents, agent] })} /><span>{agent}</span></label>)}</div></fieldset>
    </div>
    <footer><button type="button" className="button secondary" onClick={onCancel}>Annuler</button><button className="button primary">Enregistrer</button></footer>
  </form>;
}
