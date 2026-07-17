import type { Agent, WorkspaceFile } from "../types";

export const initialAgents: Agent[] = [
  {
    id: "pi-core",
    name: "Pi Core",
    role: "Orchestrateur principal",
    description: "Coordinates missions, distributes context and supervises specialized agents.",
    prompt: "You are the executive core of Agentic OS. Clarifies, delegates and summarizes each mission.",
    model: "Claude Sonnet 4",
    tools: ["Filesystem", "Shell", "Web", "Git"],
    parentId: null,
    status: "active",
    progress: 72,
    task: "Workspace mapping",
    color: "cyan",
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "System Architect",
    description: "Analyzes the architecture, dependencies and structure of projects.",
    prompt: "You transform intentions into clear, maintainable and testable architecture.",
    model: "GPT-5.4",
    tools: ["Filesystem", "Git", "Terminal"],
    parentId: "pi-core",
    status: "active",
    progress: 48,
    task: "Dependency Indexing",
    color: "violet",
  },
  {
    id: "muse",
    name: "Muse",
    role: "Designer produit",
    description: "Designs the interfaces, flows and visual coherence of the system.",
    prompt: "You design calm, readable and ambitious experiences, without visual noise.",
    model: "Gemini 2.5 Pro",
    tools: ["Browser", "Images", "Files"],
    parentId: "pi-core",
    status: "idle",
    progress: 100,
    task: "Visual system delivered",
    color: "rose",
  },
  {
    id: "heron",
    name: "Heron",
    role: "Analyste quantitatif",
    description: "Prepares hypotheses and reports that will later feed Vibe-Trading.",
    prompt: "You reason with verifiable hypotheses. You separate signal, noise and uncertainty.",
    model: "DeepSeek V3",
    tools: ["Python", "Market Data", "Reports"],
    parentId: "pi-core",
    status: "paused",
    progress: 18,
    task: "Waiting for Vibe-Trading",
    color: "amber",
  },
];

export const workspaceFiles: WorkspaceFile[] = [
  {
    id: "vision",
    name: "vision.md",
    type: "markdown",
    path: "/Agentic OS/Strategy/vision.md",
    updated: "12 min ago",
    content: `# Vision — Agentic OS

Create a visual intelligence layer for **Pi**: a single place to think, create, delegate and observe.

## Principles

- The context must remain visible.
- Each agent has an explicit role.
- Files are durable memory.
- All automation is observable.

> The interface must make the complex system calm and understandable.`,
  },
  {
    id: "morning",
    name: "morning-brief.md",
    type: "markdown",
    path: "/Agentic OS/Briefs/morning-brief.md",
    updated: "today, 08:04",
    content: `#MorningBrief

## To remember

1. The architecture of the workspace is stabilized.
2. Two agents completed their analysis overnight.
3. The Trading Lab module remains in simulation mode.

## Next best action

Finalize the agent hierarchy before enabling automations.`,
  },
  {
    id: "prototype",
    name: "prototype.html",
    type: "html",
    path: "/Agentic OS/Artifacts/prototype.html",
    updated: "hier, 21:42",
    content: `<section style="font-family:Inter,system-ui;background:#0a0d16;color:#eef4ff;padding:48px;border-radius:20px;min-height:280px"><p style="color:#70e1f5;text-transform:uppercase;letter-spacing:.16em;font-size:12px">Pi Intelligence Layer</p><h1 style="font-size:42px;max-width:620px;margin:18px 0">Your work, knowledge and agents in one orbit.</h1><p style="color:#9aa7bd;max-width:560px;line-height:1.7">An HTML prototype kept as an artifact, modifiable in Code mode and viewable in Visual mode from the workspace.</p><button style="margin-top:24px;background:#d9f7ff;color:#071016;border:0;border-radius:999px;padding:12px 20px">Open mission control</button></section>`,
  },
  {
    id: "agent-notes",
    name: "agent-notes.md",
    type: "markdown",
    path: "/Agentic OS/Agents/agent-notes.md",
    updated: "lun. 16:18",
    content: `# Agent design notes

Permanent agents must have:

- a visual identity;
- an editable role and prompt;
- a place in the hierarchy;
- a model and a list of tools;
- a readable status in real time.`,
  },
];

export const activity = [
  { time: "10:42", agent: "Atlas", text: "mapped 28 dependencies", tone: "violet" },
  { time: "10:38", agent: "Pi Core", text: "consolidated the context of the mission", tone: "cyan" },
  { time: "10:31", agent: "Muse", text: "delivered the visual direction", tone: "rose" },
  { time: "10:12", agent: "System", text: "indexed 142 files", tone: "neutral" },
];

export const missions = [
  { id: "m1", title: "Design the Agentic OS", owner: "Pi Core", status: "In progress", progress: 64, due: "Today", priority: "High" },
  { id: "m2", title: "Structure the Knowledge Graph", owner: "Atlas", status: "In progress", progress: 38, due: "Tomorrow", priority: "High" },
  { id: "m3", title: "Define agent roles", owner: "Muse", status: "To be validated", progress: 90, due: "Today", priority: "Medium" },
  { id: "m4", title: "Prepare Vibe-Trading", owner: "Heron", status: "On hold", progress: 12, due: "Later", priority: "Low" },
];
