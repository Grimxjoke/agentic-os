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
  { id: "dream", name: "Dream sequence", schedule: "Every day", time: "23:00", enabled: true, agent: "Pi Core", steps: [makeStep("trigger", "Every evening at 11:00 p.m."), makeStep("tool", "Collect changes"), makeStep("agent", "Analyze patterns"), makeStep("output", "Write the morning brief")], lastRun: "Yesterday · 23:04", nextRun: "Today · 23:00" },
  { id: "index", name: "Workspace index", schedule: "Every 4 hours", time: "12:00", enabled: true, agent: "Atlas", steps: [makeStep("trigger", "Every 4 hours"), makeStep("tool", "Scan the workspace"), makeStep("agent", "Extract links"), makeStep("output", "Update graph")], lastRun: "08:00", nextRun: "12:00" },
  { id: "research", name: "Research pulse", schedule: "Every Monday", time: "06:00", enabled: false, agent: "Heron", steps: [makeStep("trigger", "Every Monday at 06:00"), makeStep("tool", "Load the watchlist"), makeStep("agent", "Analyze regimes"), makeStep("approval", "Paul's approval"), makeStep("output", "Create a Kanban card")], lastRun: "Never", nextRun: "Disabled" },
];

const palette: Array<{ kind: StepKind; label: string; description: string; icon: typeof Sparkles }> = [
  { kind: "trigger", label: "Time trigger", description: "Date, time or recurrence", icon: AlarmClock },
  { kind: "trigger", label: "File event", description: "Creation or modification", icon: FileOutput },
  { kind: "trigger", label: "Webhook", description: "Incoming HTTP signal", icon: Webhook },
  { kind: "agent", label: "Agent instruction", description: "Pi or sub-agent", icon: Bot },
  { kind: "condition", label: "Condition", description: "Continue if…", icon: GitBranch },
  { kind: "loop", label: "Loop", description: "For each element", icon: Repeat2 },
  { kind: "tool", label: "Tool call", description: "Skill or command", icon: Code2 },
  { kind: "notification", label: "Notification", description: "Create an alert", icon: Zap },
  { kind: "approval", label: "Human approval", description: "Wait for Paul", icon: UserCheck },
  { kind: "output", label: "Create an artifact", description: "Markdown or HTML", icon: FileOutput },
];

const kindMeta: Record<StepKind, { label: string; tone: string; icon: typeof Sparkles }> = {
  trigger: { label: "Trigger", tone: "cyan", icon: CalendarClock },
  agent: { label: "Agent", tone: "violet", icon: Bot },
  condition: { label: "Condition", tone: "amber", icon: GitBranch },
  loop: { label: "Loop", tone: "violet", icon: Repeat2 },
  tool: { label: "Tool", tone: "cyan", icon: Code2 },
  notification: { label: "Notification", tone: "rose", icon: Zap },
  approval: { label: "Approval", tone: "amber", icon: UserCheck },
  output: { label: "Output", tone: "rose", icon: FileOutput },
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
    { id: 1, role: "pi", text: "Describe to me the desired routine. I will prepare a visual plan, but I will always wait for your validation before modifying the workflow." },
  ]);

  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];
  const steps = useMemo(() => selected ? normalizeSteps(selected.steps) : [], [selected]);
  const selectedStep = steps.find((step) => step.id === selectedStepId);

  const update = (patch: Partial<CronJob>) => setJobs((current) => current.map((job) => job.id === selected.id ? { ...job, ...patch } : job));
  const updateSteps = (next: CronStep[]) => update({ steps: next });
  const addJob = () => {
    const job: CronJob = { id: "cron-" + Date.now(), name: "New workflow", schedule: "Every day", time: "09:00", enabled: false, agent: "Pi Core", steps: [makeStep("trigger", "Every day at 09:00"), makeStep("agent", "Ask Pi to carry out the mission"), makeStep("output", "Create an artifact")], lastRun: "Never", nextRun: "Unplanned" };
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
    const isTrading = /trading|market|crypto|btc|stock/.test(lower);
    const isFile = /file|workspace|folder|markdown|html/.test(lower);
    const isMorning = /morning|brief|report|summary/.test(lower);
    const draft: Draft = isTrading ? {
      name: "Market intelligence pulse", schedule: "Every day", time: "08:30", agent: "Heron",
      summary: "Observe the markets, filter signals and request validation before producing a rating.",
      steps: [makeStep("trigger", "Every working day at 08:30"), makeStep("tool", "Load watchlist and market data"), makeStep("agent", "Heron analyzes diets"), makeStep("condition", "Confidence above 70%"), makeStep("approval", "Validation of Paul"), makeStep("output", "Create a research note")],
    } : isFile ? {
      name: "Workspace change monitor", schedule: "Every 4 hours", time: "12:00", agent: "Atlas",
      summary: "Monitor the workspace, index changes and notify Pi if action is required.",
      steps: [makeStep("trigger", "Each time a file is modified"), makeStep("tool", "Read modified files"), makeStep("agent", "Atlas indexes and links content"), makeStep("condition", "Significant change detected"), makeStep("notification", "Notify Pi and Paul"), makeStep("output", "Update graph")],
    } : {
      name: isMorning ? "Morning intelligence brief" : "Routine orchestrated by Pi", schedule: "Every day", time: isMorning ? "07:30" : "09:00", agent: "Pi Core",
      summary: "Collect the useful context, request a synthesis from Pi then deliver an artifact with human control.",
      steps: [makeStep("trigger", isMorning ? "Every morning at 07:30" : "Every day at 09:00"), makeStep("tool", "Collect recent changes"), makeStep("agent", "Pi synthesizes information"), makeStep("approval", "Validation of Paul"), makeStep("output", "Create a Markdown artifact")],
    };
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: request }, { id: Date.now() + 1, role: "pi", text: `I prepared a ${draft.steps.length}-block workflow. Check the visual plan: I will only apply it after your approval.` }]);
    setPendingDraft(draft);
    setPrompt("");
  };

  const approveDraft = () => {
    if (!pendingDraft) return;
    update({ name: pendingDraft.name, schedule: pendingDraft.schedule, time: pendingDraft.time, agent: pendingDraft.agent, steps: pendingDraft.steps, enabled: false, nextRun: "Ready to activate" });
    setMessages((current) => [...current, { id: Date.now(), role: "pi", text: "Workflow applied to the canvas. It remains disabled until you activate its switch." }]);
    setPendingDraft(null);
  };

  return <div className="page cron-page v04-page">
    <PageHeader eyebrow="Cron Studio · visual automation" title="Pi-driven automations" description="Compose a guided routine, move each block, or simply describe the expected result to Pi." actions={<button className="button primary" onClick={addJob}><Plus size={15} />New workflow</button>} />

    <section className="cron-summary reveal delay-1">
      <div><Timer size={18} /><p><strong>{jobs.filter((job) => job.enabled).length}</strong><span>Active workflows</span></p></div>
      <div><CheckCircle2 size={18} /><p><strong>24</strong><span>Successful cycles</span></p></div>
      <div><Clock3 size={18} /><p><strong>23:00</strong><span>Next execution</span></p></div>
    </section>

    <div className="cron-layout reveal delay-2">
      <aside className="cron-list glass-panel v04-surface">
        <header><span>WORKFLOWS</span><button className="icon-button" aria-label="Workflow options"><MoreHorizontal size={16} /></button></header>
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
          <div><label className="switch"><input type="checkbox" checked={selected.enabled} onChange={() => update({ enabled: !selected.enabled })} /><span /></label><button className="button primary compact" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1500); }}><Save size={13} />{saved ? "Saved" : "Save"}</button></div>
        </header>

        <div className="cron-settings-row">
          <label><span>Frequency</span><select value={selected.schedule} onChange={(event) => update({ schedule: event.target.value })}><option>Every day</option><option>Every 4 hours</option><option>Every Monday</option><option>Every month</option><option>On event</option></select></label>
          <label><span>Time</span><input type="time" value={selected.time} onChange={(event) => update({ time: event.target.value })} /></label>
          <label><span>Responsible agent</span><select value={selected.agent} onChange={(event) => update({ agent: event.target.value })}><option>Pi Core</option><option>Atlas</option><option>Muse</option><option>Heron</option></select></label>
        </div>

        <div className="cron-studio">
          <aside className="node-palette">
            <header><span><WandSparkles size={14} />BLOCKS</span><small>Drag onto the canvas</small></header>
            <div>{palette.map(({ kind, label, description, icon: Icon }) => <button draggable onDragStart={(event) => startDrag(event, { source: "palette", kind, label })} onClick={() => updateSteps([...steps, makeStep(kind, label)])} key={kind + label}><span className={"palette-icon tone-" + kindMeta[kind].tone}><Icon size={14} /></span><span><strong>{label}</strong><small>{description}</small></span><GripVertical size={13} /></button>)}</div>
          </aside>

          <div className="workflow-workbench">
            <header><div><p className="section-kicker">Guided Canvas</p><h3>{steps.length} blocks · active drag and drop</h3></div><span className="status-pill active"><i />DRAFT LOCAL</span></header>
            <div className="workflow-canvas v04-workflow" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropAt(event, steps.length)}>
              <div className="workflow-track" />
              <DropZone active={Boolean(dragged)} onDrop={(event) => dropAt(event, 0)} />
              {steps.map((step, index) => <div className="workflow-segment" key={step.id}>
                {index > 0 && <span className="flow-connector"><ChevronRight size={15} /></span>}
                <WorkflowNode step={step} selected={selectedStepId === step.id} onClick={() => setSelectedStepId(step.id)} onDragStart={(event) => startDrag(event, { source: "canvas", kind: step.kind, label: step.label, index })} />
                <DropZone active={Boolean(dragged)} onDrop={(event) => dropAt(event, index + 1)} />
              </div>)}
              {!steps.length && <button className="empty-workflow" onClick={() => updateSteps([makeStep("trigger", "New trigger")])}><Plus size={18} />Drop a block here</button>}
            </div>

            {selectedStep && <div className="node-inspector">
              <div><span className={"palette-icon tone-" + kindMeta[selectedStep.kind].tone}>{kindMeta[selectedStep.kind].icon({ size: 14 })}</span><p><strong>Edit block</strong><small>Changes are saved locally</small></p></div>
              <label><span>Type</span><select value={selectedStep.kind} onChange={(event) => updateStep({ kind: event.target.value as StepKind })}>{Object.entries(kindMeta).map(([kind, meta]) => <option key={kind} value={kind}>{meta.label}</option>)}</select></label>
              <label><span>Instruction</span><input value={selectedStep.label} onChange={(event) => updateStep({ label: event.target.value })} /></label>
              <div className="node-order"><button className="icon-button" onClick={() => moveStep(steps.indexOf(selectedStep), -1)} aria-label="Move left"><ChevronLeft size={15} /></button><button className="icon-button" onClick={() => moveStep(steps.indexOf(selectedStep), 1)} aria-label="Move right"><ChevronRight size={15} /></button><button className="icon-button danger" onClick={removeStep} aria-label="Delete block"><Trash2 size={15} /></button><button className="icon-button" onClick={() => setSelectedStepId("")} aria-label="Close the inspector"><X size={15} /></button></div>
            </div>}
          </div>
        </div>

        <section className="cron-ai-studio">
          <div className="cron-ai-chat">
            <header><span className="pi-mini-orbit"><Bot size={16} /></span><div><p className="section-kicker">Pi workflow copilot</p><h3>Describe your automation</h3></div><em><i />PLAN MODE</em></header>
            <div className="cron-chat-messages">{messages.slice(-4).map((message) => <div className={message.role} key={message.id}>{message.role === "pi" && <Bot size={13} />}<p>{message.text}</p></div>)}</div>
            <div className="cron-prompt"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); proposeWorkflow(); } }} placeholder="For example: every morning, analyze workspace changes and create a brief for me…" /><button className="button primary" onClick={proposeWorkflow}><Send size={14} />Propose</button></div>
          </div>

          <div className={"cron-draft " + (pendingDraft ? "has-draft" : "")}>
            {pendingDraft ? <>
              <header><span><Sparkles size={15} />PLAN PROPOSED BY PI</span><em>Waiting for validation</em></header>
              <h3>{pendingDraft.name}</h3><p>{pendingDraft.summary}</p>
              <div className="draft-meta"><span><Clock3 size={13} />{pendingDraft.schedule} · {pendingDraft.time}</span><span><Bot size={13} />{pendingDraft.agent}</span></div>
              <div className="draft-flow">{pendingDraft.steps.map((step, index) => <span key={step.id}><i className={"tone-" + kindMeta[step.kind].tone}>{kindMeta[step.kind].icon({ size: 12 })}</i><strong>{step.label}</strong>{index < pendingDraft.steps.length - 1 && <ChevronRight size={12} />}</span>)}</div>
              <footer><button className="button secondary" onClick={() => setPendingDraft(null)}><X size={14} />Reject</button><button className="button primary" onClick={approveDraft}><Check size={14} />Approve and create</button></footer>
            </> : <div className="draft-empty"><MessageSquareText size={23} /><strong>No pending plans</strong><p>Pi will display its proposal here before any modification of the canvas.</p></div>}
          </div>
        </section>

        <footer className="cron-builder-footer"><span><History size={14} />Last run: {selected.lastRun}</span><button className="button secondary"><Play size={14} />Test now</button></footer>
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
