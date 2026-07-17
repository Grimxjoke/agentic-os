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

export type WorkspaceFile = {
  id: string;
  name: string;
  type: "markdown" | "html";
  path: string;
  content: string;
  updated: string;
};

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
