export type AgentStatus = "active" | "idle" | "paused";

export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  prompt: string;
  model: string;
  tools: string[];
  parentId: string | null;
  status: AgentStatus;
  progress: number;
  task: string;
  color: string;
  avatar?: string;
};

export type AgentBudget = {
  maxTokens: number;
  maxCostUsd: number;
  maxDurationMinutes: number;
  maxRetries: number;
};

export type AgentPolicy = {
  filesystem: "deny" | "read" | "write";
  network: "deny" | "allow";
  trading: "deny";
};

export type AgentDefinition = {
  id: string;
  versionId: string;
  version: number;
  name: string;
  role: string;
  description: string;
  instructions: string;
  provider: string;
  model: string;
  tools: string[];
  skills: string[];
  budget: AgentBudget;
  policy: AgentPolicy;
  color: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  versionCreatedAt: string;
};

export type TeamNode = {
  key: string;
  label: string;
  agentVersionId: string;
  task: string;
  dependsOn: string[];
  agent?: AgentDefinition;
};

export type TeamDefinition = {
  id: string;
  versionId: string;
  version: number;
  name: string;
  description: string;
  maxConcurrency: number;
  nodes: TeamNode[];
  budget: { maxTokens: number; maxCostUsd: number; maxDurationMinutes: number };
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  versionCreatedAt: string;
};

export type RunStatus = "queued" | "running" | "degraded" | "completed" | "failed" | "cancelled";
export type WorkerStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "skipped";

export type RunWorker = {
  id: string;
  runId: string;
  nodeKey: string;
  agentVersionId: string;
  attempt: number;
  status: WorkerStatus;
  sessionId: string | null;
  output: null | { content?: string; sessionId?: string };
  error: string | null;
  tokensUsed: number | null;
  costUsd: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type RunEvent = {
  id: number;
  runId: string;
  workerId: string | null;
  type: string;
  level: "info" | "warning" | "error";
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type OrbitRun = {
  id: string;
  teamId: string;
  teamVersionId: string;
  retryOfId: string | null;
  status: RunStatus;
  objective: string;
  snapshot: { team: TeamDefinition; nodes: TeamNode[] };
  maxConcurrency: number;
  totalWorkers: number;
  completedWorkers: number;
  tokensUsed: number | null;
  costUsd: number | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequestedAt: string | null;
  workers?: RunWorker[];
  currentWorkers?: RunWorker[];
  events?: RunEvent[];
  artifacts?: Array<{ id: string; name: string; kind: string; uri: string; createdAt: string }>;
};

export type WorkspaceFile = {
  id: string;
  name: string;
  type: "markdown" | "html";
  path: string;
  content: string;
  updated: string;
};

export type FileRoot = { id: string; label: string; writable: boolean };
export type FileEntry = { name: string; path: string; type: "directory" | "file"; text: boolean; bytes: number | null; updatedAt: string };
export type WorkspaceDocument = {
  rootId: string; path: string; name: string; content: string; bytes: number; checksum: string;
  mimeType: string; updatedAt: string; writable: boolean;
};
export type FileBackup = { id: string; rootId: string; relativePath: string; checksum: string; bytes: number; createdBy: string; createdAt: string };

export type ArtifactRecord = {
  id: string; sourceType: "file" | "run"; sourceId: string; rootId: string | null; path: string | null;
  runId: string | null; name: string; kind: string; mimeType: string | null; bytes: number | null;
  checksum: string | null; indexedAt: string;
};

export type MemoryRecord = {
  id: string; title: string; content: string; kind: "fact" | "preference" | "decision" | "learning";
  confidence: number; pinned: boolean; sourceType: "file" | "run" | "agent" | "hypothesis" | "manual";
  sourceId: string | null; sourceUri: string | null; createdBy: string; createdAt: string; updatedAt: string;
};

export type HypothesisRecord = {
  id: string; title: string; statement: string; rationale: string;
  status: "draft" | "testing" | "supported" | "rejected" | "inconclusive"; tags: string[];
  sourceType: "file" | "run" | "agent" | "memory" | "manual"; sourceId: string | null;
  sourceUri: string | null; createdBy: string; createdAt: string; updatedAt: string;
};

export type KnowledgeNode = { id: string; entityId: string; type: "agent" | "team" | "run" | "artifact" | "hypothesis" | "memory"; label: string; detail: string; uri: string };
export type KnowledgeEdge = { source: string; target: string; type: string };
export type KnowledgeGraph = { generatedAt: string; nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };

export type SystemServiceStatus = "operational" | "available" | "unavailable" | "deferred";

export type SystemService = {
  id: string;
  name: string;
  status: SystemServiceStatus;
  detail: string;
};

export type ActivityEvent = {
  id: number;
  jobId: string | null;
  type: string;
  level: "info" | "warning" | "error";
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type Observatory = {
  generatedAt: string;
  agents: number;
  teams: number;
  statuses: Partial<Record<RunStatus, number>>;
  activeWorkers: Array<{ id: string; runId: string; nodeKey: string; status: string; agentName: string; color: string; objective: string; startedAt: string }>;
  recentRuns: OrbitRun[];
  usage: { tokens: number | null; costUsd: number | null };
  successRate: number | null;
  activity: ActivityEvent[];
};

export type SystemOverview = {
  ok: true;
  generatedAt: string;
  version: string;
  runtime: { node: string; uptimeSeconds: number; memoryBytes: number };
  database: { status: "operational"; engine: string; schemaVersion: number; bytes: number };
  counts: {
    activeSessions: number;
    conversations: number;
    messages: number;
    jobs: number;
    runningJobs: number;
    events: number;
    pendingDecisions: number;
    auditEntries: number;
    agents: number;
    teams: number;
    runs: number;
    runningRuns: number;
  };
  services: SystemService[];
  activity: ActivityEvent[];
};

export type Conversation = {
  id: string;
  agent: "pi" | "codex";
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  mode: "plan" | "build";
  content: string;
  createdAt: string;
};
