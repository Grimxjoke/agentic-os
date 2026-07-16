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
