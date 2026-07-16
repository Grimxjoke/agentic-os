import type { Agent, WorkspaceFile } from "../types";

export const initialAgents: Agent[] = [
  {
    id: "pi-core",
    name: "Pi Core",
    role: "Orchestrateur principal",
    description: "Coordonne les missions, distribue le contexte et supervise les agents spécialisés.",
    prompt: "Tu es le noyau exécutif de l'Agentic OS. Clarifie, délègue et synthétise chaque mission.",
    model: "Claude Sonnet 4",
    tools: ["Filesystem", "Shell", "Web", "Git"],
    parentId: null,
    status: "active",
    progress: 72,
    task: "Cartographie du workspace",
    color: "cyan",
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Architecte système",
    description: "Analyse l'architecture, les dépendances et la structure des projets.",
    prompt: "Tu transformes les intentions en architecture claire, maintenable et testable.",
    model: "GPT-5.4",
    tools: ["Filesystem", "Git", "Terminal"],
    parentId: "pi-core",
    status: "active",
    progress: 48,
    task: "Indexation des dépendances",
    color: "violet",
  },
  {
    id: "muse",
    name: "Muse",
    role: "Designer produit",
    description: "Conçoit les interfaces, les flux et la cohérence visuelle du système.",
    prompt: "Tu conçois des expériences calmes, lisibles et ambitieuses, sans bruit visuel.",
    model: "Gemini 2.5 Pro",
    tools: ["Browser", "Images", "Files"],
    parentId: "pi-core",
    status: "idle",
    progress: 100,
    task: "Système visuel livré",
    color: "rose",
  },
  {
    id: "heron",
    name: "Heron",
    role: "Analyste quantitatif",
    description: "Prépare les hypothèses et rapports qui alimenteront plus tard Vibe-Trading.",
    prompt: "Tu raisonnes par hypothèses vérifiables. Tu sépares signal, bruit et incertitude.",
    model: "DeepSeek V3",
    tools: ["Python", "Market Data", "Reports"],
    parentId: "pi-core",
    status: "paused",
    progress: 18,
    task: "En attente de Vibe-Trading",
    color: "amber",
  },
];

export const workspaceFiles: WorkspaceFile[] = [
  {
    id: "vision",
    name: "vision.md",
    type: "markdown",
    path: "/Agentic OS/Strategy/vision.md",
    updated: "il y a 12 min",
    content: `# Vision — Agentic OS\n\nCréer une couche d'intelligence visuelle pour **Pi** : un endroit unique pour penser, créer, déléguer et observer.\n\n## Principes\n\n- Le contexte doit rester visible.\n- Chaque agent possède un rôle explicite.\n- Les fichiers sont la mémoire durable.\n- Toute automatisation est observable.\n\n> L'interface doit rendre le système complexe calme et compréhensible.`,
  },
  {
    id: "morning",
    name: "morning-brief.md",
    type: "markdown",
    path: "/Agentic OS/Briefs/morning-brief.md",
    updated: "aujourd'hui, 08:04",
    content: `# Morning Brief\n\n## À retenir\n\n1. L'architecture du workspace est stabilisée.\n2. Deux agents ont terminé leur analyse pendant la nuit.\n3. Le module Trading Lab reste en mode simulation.\n\n## Prochaine meilleure action\n\nFinaliser la hiérarchie des agents avant d'activer les automatisations.`,
  },
  {
    id: "prototype",
    name: "prototype.html",
    type: "html",
    path: "/Agentic OS/Artifacts/prototype.html",
    updated: "hier, 21:42",
    content: `<section style="font-family:Inter,system-ui;background:#0a0d16;color:#eef4ff;padding:48px;border-radius:20px;min-height:280px"><p style="color:#70e1f5;text-transform:uppercase;letter-spacing:.16em;font-size:12px">Pi Intelligence Layer</p><h1 style="font-size:42px;max-width:620px;margin:18px 0">Your work, knowledge and agents in one orbit.</h1><p style="color:#9aa7bd;max-width:560px;line-height:1.7">Un prototype HTML conservé comme artifact, modifiable en mode Code et consultable en mode Visual depuis le workspace.</p><button style="margin-top:24px;background:#d9f7ff;color:#071016;border:0;border-radius:999px;padding:12px 20px">Open mission control</button></section>`,
  },
  {
    id: "agent-notes",
    name: "agent-notes.md",
    type: "markdown",
    path: "/Agentic OS/Agents/agent-notes.md",
    updated: "lun. 16:18",
    content: `# Agent design notes\n\nLes agents permanents doivent avoir :\n\n- une identité visuelle ;\n- un rôle et un prompt modifiables ;\n- une place dans la hiérarchie ;\n- un modèle et une liste d'outils ;\n- un état lisible en temps réel.`,
  },
];

export const activity = [
  { time: "10:42", agent: "Atlas", text: "a cartographié 28 dépendances", tone: "violet" },
  { time: "10:38", agent: "Pi Core", text: "a consolidé le contexte de la mission", tone: "cyan" },
  { time: "10:31", agent: "Muse", text: "a livré la direction visuelle", tone: "rose" },
  { time: "10:12", agent: "System", text: "a indexé 142 fichiers", tone: "neutral" },
];

export const missions = [
  { id: "m1", title: "Concevoir l'Agentic OS", owner: "Pi Core", status: "En cours", progress: 64, due: "Aujourd'hui", priority: "Haute" },
  { id: "m2", title: "Structurer le Knowledge Graph", owner: "Atlas", status: "En cours", progress: 38, due: "Demain", priority: "Haute" },
  { id: "m3", title: "Définir les rôles agents", owner: "Muse", status: "À valider", progress: 90, due: "Aujourd'hui", priority: "Moyenne" },
  { id: "m4", title: "Préparer Vibe-Trading", owner: "Heron", status: "En veille", progress: 12, due: "Plus tard", priority: "Basse" },
];
