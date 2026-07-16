import { useMemo, useState, type DragEvent } from "react";
import {
  AlarmClock, Bot, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Code2, FileOutput, GitBranch, GripVertical, History, MessageSquareText,
  MoreHorizontal, Play, Plus, Repeat2, Save, Send, Sparkles, Timer, Trash2,
  UserCheck, Webhook, WandSparkles, X, Zap,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocalStorage } from "../hooks/useLocalStorage";

type StepKind = "trigger" | "agent" | "condition" | "loop" | "tool" | "notification" | "approval" | "output";
type CronStep = { id: string; kind: StepKind; label: string };
type CronJob = {
  id: string;
  name: string;
  schedule: string;
  time: string;
  enabled: boolean;
  agent: string;
  steps: Array<CronStep | string>;
  lastRun: string;
  nextRun: string;
};
type PiMessage = { id: number; role: "pi" | "user"; text: string };
type Draft = { name: string; schedule: string; time: string; agent: string; summary: string; steps: CronStep[] };

const makeStep = (kind: StepKind, label: string): CronStep => ({ id: kind + "-" + Math.random().toString(36).slice(2, 9), kind, label });
const normalizeSteps = (steps: Array<CronStep | string>) => steps.map((step, index) => typeof step === "string" ? makeStep(index === 0 ? "trigger" : index === steps.length - 1 ? "output" : "agent", step) : step);

const seedJobs: CronJob[] = [
  { id: "dream", name: "Dream sequence", schedule: "Tous les jours", time: "23:00", enabled: true, agent: "Pi Core", steps: [makeStep("trigger", "Chaque soir à 23:00"), makeStep("tool", "Collecter les changements"), makeStep("agent", "Analyser les patterns"), makeStep("output", "Écrire le morning brief")], lastRun: "Hier · 23:04", nextRun: "Aujourd'hui · 23:00" },
  { id: "index", name: "Workspace index", schedule: "Toutes les 4 heures", time: "12:00", enabled: true, agent: "Atlas", steps: [makeStep("trigger", "Toutes les 4 heures"), makeStep("tool", "Scanner le workspace"), makeStep("agent", "Extraire les liens"), makeStep("output", "Mettre à jour le graphe")], lastRun: "08:00", nextRun: "12:00" },
  { id: "research", name: "Research pulse", schedule: "Chaque lundi", time: "06:00", enabled: false, agent: "Heron", steps: [makeStep("trigger", "Chaque lundi à 06:00"), makeStep("tool", "Charger la watchlist"), makeStep("agent", "Analyser les régimes"), makeStep("approval", "Validation de Paul"), makeStep("output", "Créer une carte Kanban")], lastRun: "Jamais", nextRun: "Désactivé" },
];

const palette: Array<{ kind: StepKind; label: string; description: string; icon: typeof Sparkles }> = [
  { kind: "trigger", label: "Déclencheur horaire", description: "Date, heure ou récurrence", icon: AlarmClock },
  { kind: "trigger", label: "Événement fichier", description: "Création ou modification", icon: FileOutput },
  { kind: "trigger", label: "Webhook", description: "Signal entrant HTTP", icon: Webhook },
  { kind: "agent", label: "Instruction agent", description: "Pi ou sous-agent", icon: Bot },
  { kind: "condition", label: "Condition", description: "Continuer si…", icon: GitBranch },
  { kind: "loop", label: "Boucle", description: "Pour chaque élément", icon: Repeat2 },
  { kind: "tool", label: "Appel d’outil", description: "Skill ou commande", icon: Code2 },
  { kind: "notification", label: "Notification", description: "Créer une alerte", icon: Zap },
  { kind: "approval", label: "Validation humaine", description: "Attendre Paul", icon: UserCheck },
  { kind: "output", label: "Créer un artifact", description: "Markdown ou HTML", icon: FileOutput },
];

const kindMeta: Record<StepKind, { label: string; tone: string; icon: typeof Sparkles }> = {
  trigger: { label: "Déclencheur", tone: "cyan", icon: CalendarClock },
  agent: { label: "Agent", tone: "violet", icon: Bot },
  condition: { label: "Condition", tone: "amber", icon: GitBranch },
  loop: { label: "Boucle", tone: "violet", icon: Repeat2 },
  tool: { label: "Outil", tone: "cyan", icon: Code2 },
  notification: { label: "Notification", tone: "rose", icon: Zap },
  approval: { label: "Validation", tone: "amber", icon: UserCheck },
  output: { label: "Sortie", tone: "rose", icon: FileOutput },
};

export function CronPage() {
  const [jobs, setJobs] = useLocalStorage<CronJob[]>("pi-os-cron", seedJobs);
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? "");
  const [selectedStepId, setSelectedStepId] = useState("");
  const [saved, setSaved] = useState(false);
  const [dragged, setDragged] = useState<{ source: "palette" | "canvas"; kind: StepKind; label: string; index?: number } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [messages, setMessages] = useState<PiMessage[]>([
    { id: 1, role: "pi", text: "Décris-moi la routine souhaitée. Je préparerai un plan visuel, mais j’attendrai toujours ta validation avant de modifier le workflow." },
  ]);

  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];
  const steps = useMemo(() => selected ? normalizeSteps(selected.steps) : [], [selected]);
  const selectedStep = steps.find((step) => step.id === selectedStepId);

  const update = (patch: Partial<CronJob>) => setJobs((current) => current.map((job) => job.id === selected.id ? { ...job, ...patch } : job));
  const updateSteps = (next: CronStep[]) => update({ steps: next });
  const addJob = () => {
    const job: CronJob = { id: "cron-" + Date.now(), name: "Nouveau workflow", schedule: "Tous les jours", time: "09:00", enabled: false, agent: "Pi Core", steps: [makeStep("trigger", "Tous les jours à 09:00"), makeStep("agent", "Demander à Pi d’exécuter la mission"), makeStep("output", "Créer un artifact")], lastRun: "Jamais", nextRun: "Non planifié" };
    setJobs((current) => [...current, job]);
    setSelectedId(job.id);
    setSelectedStepId("");
  };

  const startDrag = (event: DragEvent, payload: typeof dragged) => {
    if (!payload) return;
    setDragged(payload);
    event.dataTransfer.effectAllowed = payload.source === "palette" ? "copy" : "move";
    event.dataTransfer.setData("text/plain", payload.label);
  };
  const dropAt = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (!dragged) return;
    const next = [...steps];
    if (dragged.source === "canvas" && dragged.index !== undefined) {
      const [moving] = next.splice(dragged.index, 1);
      const correctedIndex = dragged.index < targetIndex ? targetIndex - 1 : targetIndex;
      next.splice(Math.max(0, correctedIndex), 0, moving);
    } else {
      next.splice(targetIndex, 0, makeStep(dragged.kind, dragged.label));
    }
    updateSteps(next);
    setDragged(null);
  };
  const moveStep = (index: number, delta: number) => {
    const next = [...steps];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateSteps(next);
  };
  const updateStep = (patch: Partial<CronStep>) => {
    if (!selectedStep) return;
    updateSteps(steps.map((step) => step.id === selectedStep.id ? { ...step, ...patch } : step));
  };
  const removeStep = () => {
    if (!selectedStep) return;
    updateSteps(steps.filter((step) => step.id !== selectedStep.id));
    setSelectedStepId("");
  };

  const proposeWorkflow = () => {
    const request = prompt.trim();
    if (!request) return;
    const lower = request.toLowerCase();
    const isTrading = /trading|marché|crypto|btc|action/.test(lower);
    const isFile = /fichier|workspace|dossier|markdown|html/.test(lower);
    const isMorning = /matin|brief|rapport|résumé/.test(lower);
    const draft: Draft = isTrading ? {
      name: "Market intelligence pulse", schedule: "Tous les jours", time: "08:30", agent: "Heron",
      summary: "Observer les marchés, filtrer les signaux et demander une validation avant de produire une note.",
      steps: [makeStep("trigger", "Chaque jour ouvré à 08:30"), makeStep("tool", "Charger watchlist et données marché"), makeStep("agent", "Heron analyse les régimes"), makeStep("condition", "Confiance supérieure à 70%"), makeStep("approval", "Validation de Paul"), makeStep("output", "Créer une note de recherche")],
    } : isFile ? {
      name: "Workspace change monitor", schedule: "Toutes les 4 heures", time: "12:00", agent: "Atlas",
      summary: "Surveiller le workspace, indexer les changements et notifier Pi si une action est requise.",
      steps: [makeStep("trigger", "À chaque modification de fichier"), makeStep("tool", "Lire les fichiers modifiés"), makeStep("agent", "Atlas indexe et relie le contenu"), makeStep("condition", "Changement important détecté"), makeStep("notification", "Notifier Pi et Paul"), makeStep("output", "Mettre à jour le graphe")],
    } : {
      name: isMorning ? "Morning intelligence brief" : "Routine orchestrée par Pi", schedule: "Tous les jours", time: isMorning ? "07:30" : "09:00", agent: "Pi Core",
      summary: "Collecter le contexte utile, demander une synthèse à Pi puis livrer un artifact avec contrôle humain.",
      steps: [makeStep("trigger", isMorning ? "Chaque matin à 07:30" : "Tous les jours à 09:00"), makeStep("tool", "Collecter les changements récents"), makeStep("agent", "Pi synthétise les informations"), makeStep("approval", "Validation de Paul"), makeStep("output", "Créer un artifact Markdown")],
    };
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: request }, { id: Date.now() + 1, role: "pi", text: "J’ai préparé un workflow de " + draft.steps.length + " blocs. Vérifie le plan visuel ci-contre : je ne l’appliquerai qu’après ta validation." }]);
    setPendingDraft(draft);
    setPrompt("");
  };

  const approveDraft = () => {
    if (!pendingDraft) return;
    update({ name: pendingDraft.name, schedule: pendingDraft.schedule, time: pendingDraft.time, agent: pendingDraft.agent, steps: pendingDraft.steps, enabled: false, nextRun: "Prêt à activer" });
    setMessages((current) => [...current, { id: Date.now(), role: "pi", text: "Workflow appliqué au canvas. Il reste désactivé jusqu’à ce que tu actives son interrupteur." }]);
    setPendingDraft(null);
  };

  return <div className="page cron-page v04-page">
    <PageHeader eyebrow="Cron Studio · visual automation" title="Automations pilotées par Pi" description="Composez une routine guidée, déplacez chaque bloc, ou décrivez simplement le résultat attendu à Pi." actions={<button className="button primary" onClick={addJob}><Plus size={15} />Nouveau workflow</button>} />

    <section className="cron-summary reveal delay-1">
      <div><Timer size={18} /><p><strong>{jobs.filter((job) => job.enabled).length}</strong><span>Workflows actifs</span></p></div>
      <div><CheckCircle2 size={18} /><p><strong>24</strong><span>Cycles réussis</span></p></div>
      <div><Clock3 size={18} /><p><strong>23:00</strong><span>Prochaine exécution</span></p></div>
    </section>

    <div className="cron-layout reveal delay-2">
      <aside className="cron-list glass-panel v04-surface">
        <header><span>WORKFLOWS</span><button className="icon-button" aria-label="Options des workflows"><MoreHorizontal size={16} /></button></header>
        {jobs.map((job) => <button key={job.id} className={selected?.id === job.id ? "selected" : ""} onClick={() => { setSelectedId(job.id); setSelectedStepId(""); }}>
          <span className={"cron-state " + (job.enabled ? "active" : "")}><Timer size={15} /></span>
          <span><strong>{job.name}</strong><small>{job.nextRun}</small></span>
          <i className={job.enabled ? "active" : ""} />
          <ChevronRight size={14} />
        </button>)}
      </aside>

      {selected && <section className="cron-builder glass-panel v04-surface">
        <header className="cron-builder-head">
          <div><p className="eyebrow"><span />Workflow builder</p><input value={selected.name} onChange={(event) => update({ name: event.target.value })} /></div>
          <div><label className="switch"><input type="checkbox" checked={selected.enabled} onChange={() => update({ enabled: !selected.enabled })} /><span /></label><button className="button primary compact" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1500); }}><Save size={13} />{saved ? "Enregistré" : "Enregistrer"}</button></div>
        </header>

        <div className="cron-settings-row">
          <label><span>Fréquence</span><select value={selected.schedule} onChange={(event) => update({ schedule: event.target.value })}><option>Tous les jours</option><option>Toutes les 4 heures</option><option>Chaque lundi</option><option>Chaque mois</option><option>Sur événement</option></select></label>
          <label><span>Heure</span><input type="time" value={selected.time} onChange={(event) => update({ time: event.target.value })} /></label>
          <label><span>Agent responsable</span><select value={selected.agent} onChange={(event) => update({ agent: event.target.value })}><option>Pi Core</option><option>Atlas</option><option>Muse</option><option>Heron</option></select></label>
        </div>

        <div className="cron-studio">
          <aside className="node-palette">
            <header><span><WandSparkles size={14} />BLOCS</span><small>Glissez sur le canvas</small></header>
            <div>{palette.map(({ kind, label, description, icon: Icon }) => <button draggable onDragStart={(event) => startDrag(event, { source: "palette", kind, label })} onClick={() => updateSteps([...steps, makeStep(kind, label)])} key={kind + label}><span className={"palette-icon tone-" + kindMeta[kind].tone}><Icon size={14} /></span><span><strong>{label}</strong><small>{description}</small></span><GripVertical size={13} /></button>)}</div>
          </aside>

          <div className="workflow-workbench">
            <header><div><p className="section-kicker">Canvas guidé</p><h3>{steps.length} blocs · glisser-déposer actif</h3></div><span className="status-pill active"><i />DRAFT LOCAL</span></header>
            <div className="workflow-canvas v04-workflow" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropAt(event, steps.length)}>
              <div className="workflow-track" />
              <DropZone active={Boolean(dragged)} onDrop={(event) => dropAt(event, 0)} />
              {steps.map((step, index) => <div className="workflow-segment" key={step.id}>
                {index > 0 && <span className="flow-connector"><ChevronRight size={15} /></span>}
                <WorkflowNode step={step} selected={selectedStepId === step.id} onClick={() => setSelectedStepId(step.id)} onDragStart={(event) => startDrag(event, { source: "canvas", kind: step.kind, label: step.label, index })} />
                <DropZone active={Boolean(dragged)} onDrop={(event) => dropAt(event, index + 1)} />
              </div>)}
              {!steps.length && <button className="empty-workflow" onClick={() => updateSteps([makeStep("trigger", "Nouveau déclencheur")])}><Plus size={18} />Déposez un bloc ici</button>}
            </div>

            {selectedStep && <div className="node-inspector">
              <div><span className={"palette-icon tone-" + kindMeta[selectedStep.kind].tone}>{kindMeta[selectedStep.kind].icon({ size: 14 })}</span><p><strong>Modifier le bloc</strong><small>Les changements sont enregistrés localement</small></p></div>
              <label><span>Type</span><select value={selectedStep.kind} onChange={(event) => updateStep({ kind: event.target.value as StepKind })}>{Object.entries(kindMeta).map(([kind, meta]) => <option key={kind} value={kind}>{meta.label}</option>)}</select></label>
              <label><span>Instruction</span><input value={selectedStep.label} onChange={(event) => updateStep({ label: event.target.value })} /></label>
              <div className="node-order"><button className="icon-button" onClick={() => moveStep(steps.indexOf(selectedStep), -1)} aria-label="Déplacer à gauche"><ChevronLeft size={15} /></button><button className="icon-button" onClick={() => moveStep(steps.indexOf(selectedStep), 1)} aria-label="Déplacer à droite"><ChevronRight size={15} /></button><button className="icon-button danger" onClick={removeStep} aria-label="Supprimer le bloc"><Trash2 size={15} /></button><button className="icon-button" onClick={() => setSelectedStepId("")} aria-label="Fermer l’inspecteur"><X size={15} /></button></div>
            </div>}
          </div>
        </div>

        <section className="cron-ai-studio">
          <div className="cron-ai-chat">
            <header><span className="pi-mini-orbit"><Bot size={16} /></span><div><p className="section-kicker">Pi workflow copilot</p><h3>Décrivez votre automatisation</h3></div><em><i />PLAN MODE</em></header>
            <div className="cron-chat-messages">{messages.slice(-4).map((message) => <div className={message.role} key={message.id}>{message.role === "pi" && <Bot size={13} />}<p>{message.text}</p></div>)}</div>
            <div className="cron-prompt"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); proposeWorkflow(); } }} placeholder="Ex. Chaque matin, analyse les changements du workspace et crée un brief pour moi…" /><button className="button primary" onClick={proposeWorkflow}><Send size={14} />Proposer</button></div>
          </div>

          <div className={"cron-draft " + (pendingDraft ? "has-draft" : "")}>
            {pendingDraft ? <>
              <header><span><Sparkles size={15} />PLAN PROPOSÉ PAR PI</span><em>En attente de validation</em></header>
              <h3>{pendingDraft.name}</h3><p>{pendingDraft.summary}</p>
              <div className="draft-meta"><span><Clock3 size={13} />{pendingDraft.schedule} · {pendingDraft.time}</span><span><Bot size={13} />{pendingDraft.agent}</span></div>
              <div className="draft-flow">{pendingDraft.steps.map((step, index) => <span key={step.id}><i className={"tone-" + kindMeta[step.kind].tone}>{kindMeta[step.kind].icon({ size: 12 })}</i><strong>{step.label}</strong>{index < pendingDraft.steps.length - 1 && <ChevronRight size={12} />}</span>)}</div>
              <footer><button className="button secondary" onClick={() => setPendingDraft(null)}><X size={14} />Rejeter</button><button className="button primary" onClick={approveDraft}><Check size={14} />Valider et créer</button></footer>
            </> : <div className="draft-empty"><MessageSquareText size={23} /><strong>Aucun plan en attente</strong><p>Pi affichera ici sa proposition avant toute modification du canvas.</p></div>}
          </div>
        </section>

        <footer className="cron-builder-footer"><span><History size={14} />Dernière exécution : {selected.lastRun}</span><button className="button secondary"><Play size={14} />Tester maintenant</button></footer>
      </section>}
    </div>
  </div>;
}

function WorkflowNode({ step, selected, onClick, onDragStart }: { step: CronStep; selected: boolean; onClick: () => void; onDragStart: (event: DragEvent) => void }) {
  const meta = kindMeta[step.kind];
  const Icon = meta.icon;
  return <button className={"workflow-node tone-" + meta.tone + (selected ? " selected" : "")} draggable onDragStart={onDragStart} onClick={onClick}>
    <GripVertical size={14} /><span className="workflow-node-icon"><Icon size={17} /></span><span><small>{meta.label}</small><strong>{step.label}</strong></span><MoreHorizontal size={14} />
  </button>;
}

function DropZone({ active, onDrop }: { active: boolean; onDrop: (event: DragEvent) => void }) {
  return <span className={"workflow-dropzone " + (active ? "active" : "")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(event); }}><Plus size={12} /></span>;
}

