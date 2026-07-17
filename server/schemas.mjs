export class ValidationError extends Error {
  constructor(message, code = "invalid_request") {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Expected a JSON object");
  return value;
}

function string(value, name, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string") throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  const normalized = value.trim();
  if (normalized.length < min) throw new ValidationError(`${name} is empty`);
  if (normalized.length > max) throw new ValidationError(`${name} is too long (${max} characters maximum)`);
  return normalized;
}

function optionalId(value, name) {
  if (value === undefined || value === null || value === "") return "";
  const id = string(value, name, { max: 64 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  return id;
}

function boundedNumber(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  }
  return value;
}

function stringList(value, name, { maxItems = 32, itemMax = 80 } = {}) {
  if (!Array.isArray(value) || value.length > maxItems) throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  return [...new Set(value.map((item) => string(item, name, { max: itemMax })))];
}

function choice(value, name, choices) {
  if (!choices.includes(value)) throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  return value;
}

function identifier(value, name) {
  const id = string(value, name, { max: 64 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  return id;
}

function nodeKey(value, name = "Node key") {
  const key = string(value, name, { max: 48 }).toLowerCase();
  if (!/^[a-z][a-z0-9_-]*$/.test(key)) throw new ValidationError(`Invalid ${name.toLowerCase()}`);
  return key;
}

function validateDag(nodes) {
  const keys = new Set(nodes.map((node) => node.key));
  if (keys.size !== nodes.length) throw new ValidationError("Node keys must be unique", "duplicate_node");
  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if (!keys.has(dependency)) throw new ValidationError(`Unknown dependency: ${dependency}`, "unknown_dependency");
      if (dependency === node.key) throw new ValidationError("A node cannot depend on itself", "cyclic_team");
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (key) => {
    if (visiting.has(key)) throw new ValidationError("The DAG contains a cycle", "cyclic_team");
    if (visited.has(key)) return;
    visiting.add(key);
    const node = nodes.find((candidate) => candidate.key === key);
    for (const dependency of node.dependsOn) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  };
  for (const node of nodes) visit(node.key);
}

export function parseChatInput(value) {
  const input = object(value);
  const agent = input.agent === "pi" || input.agent === "codex" ? input.agent : "";
  if (!agent) throw new ValidationError("Invalid agent");
  return {
    agent,
    mode: input.mode === "build" ? "build" : "plan",
    message: string(input.message, "Message", { max: 16_000 }),
    conversationId: optionalId(input.conversationId, "Conversation"),
    legacySessionId: optionalId(input.sessionId, "Session runtime"),
  };
}

export function parseConversationInput(value) {
  const input = object(value);
  const agent = input.agent === "pi" || input.agent === "codex" ? input.agent : "";
  if (!agent) throw new ValidationError("Invalid agent");
  return { agent, title: input.title ? string(input.title, "Title", { max: 120 }) : "New conversation" };
}

export function parseAgent(value) {
  if (value === "pi" || value === "codex") return value;
  throw new ValidationError("Invalid agent");
}

export function parseAgentDefinitionInput(value) {
  const input = object(value);
  const budget = input.budget === undefined ? {} : object(input.budget);
  const policy = input.policy === undefined ? {} : object(input.policy);
  return {
    name: string(input.name, "Name", { min: 2, max: 80 }),
    role: string(input.role, "Role", { min: 2, max: 120 }),
    description: input.description ? string(input.description, "Description", { max: 1_000 }) : "",
    instructions: string(input.instructions, "Instructions", { max: 16_000 }),
    provider: string(input.provider || "openai-codex", "Provider", { max: 80 }),
    model: string(input.model, "Model", { max: 120 }),
    tools: stringList(input.tools || [], "Tools"),
    skills: stringList(input.skills || [], "Skills"),
    budget: {
      maxTokens: boundedNumber(budget.maxTokens ?? 100_000, "Budget tokens", { min: 1_000, max: 10_000_000, integer: true }),
      maxCostUsd: boundedNumber(budget.maxCostUsd ?? 0, "Cost budget", { min: 0, max: 10_000 }),
      maxDurationMinutes: boundedNumber(budget.maxDurationMinutes ?? 30, "Duration budget", { min: 1, max: 1_440, integer: true }),
      maxRetries: boundedNumber(budget.maxRetries ?? 1, "Retry budget", { min: 0, max: 10, integer: true }),
    },
    policy: {
      filesystem: choice(policy.filesystem || "read", "Policy filesystem", ["deny", "read", "write"]),
      network: choice(policy.network || "allow", "Network policy", ["deny", "allow"]),
      trading: choice(policy.trading || "deny", "Policy trading", ["deny"]),
    },
    color: choice(input.color || "cyan", "Color", ["cyan", "violet", "rose", "amber"]),
  };
}

export function parseTeamDefinitionInput(value) {
  const input = object(value);
  if (!Array.isArray(input.nodes) || input.nodes.length < 1 || input.nodes.length > 20) {
    throw new ValidationError("A team must contain between 1 and 20 nodes");
  }
  const nodes = input.nodes.map((candidate, index) => {
    const node = object(candidate);
    return {
      key: nodeKey(node.key, `Node ${index + 1} key`),
      label: string(node.label, `Node ${index + 1} name`, { max: 80 }),
      agentVersionId: identifier(node.agentVersionId, `Node ${index + 1} agent version`),
      task: string(node.task, `Node ${index + 1} task`, { max: 2_000 }),
      dependsOn: [...new Set((Array.isArray(node.dependsOn) ? node.dependsOn : []).map((key) => nodeKey(key, "Dependency")))],
    };
  });
  validateDag(nodes);
  const budget = input.budget === undefined ? {} : object(input.budget);
  return {
    name: string(input.name, "Team name", { min: 2, max: 100 }),
    description: input.description ? string(input.description, "Description", { max: 1_000 }) : "",
    maxConcurrency: boundedNumber(input.maxConcurrency ?? 2, "Concurrency", { min: 1, max: 2, integer: true }),
    nodes,
    budget: {
      maxTokens: boundedNumber(budget.maxTokens ?? 1_000_000, "Team token budget", { min: 1_000, max: 20_000_000, integer: true }),
      maxCostUsd: boundedNumber(budget.maxCostUsd ?? 0, "Team cost budget", { min: 0, max: 50_000 }),
      maxDurationMinutes: boundedNumber(budget.maxDurationMinutes ?? 120, "Team duration budget", { min: 1, max: 1_440, integer: true }),
    },
  };
}

export function parseRunInput(value) {
  const input = object(value);
  return {
    teamId: identifier(input.teamId, "Team"),
    objective: string(input.objective, "Objective", { max: 5_000 }),
  };
}
