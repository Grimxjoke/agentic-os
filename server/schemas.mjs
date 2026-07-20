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

function optionalString(value, name, max = 500) {
  if (value === undefined || value === null || value === "") return null;
  return string(value, name, { max });
}

function provenance(input, sourceTypes) {
  const sourceType = choice(input.sourceType || "manual", "Source type", sourceTypes);
  const sourceId = optionalString(input.sourceId, "Source identifier", 500);
  const sourceUri = optionalString(input.sourceUri, "Source URI", 1_000);
  if (sourceType !== "manual" && !sourceId && !sourceUri) {
    throw new ValidationError("A non-manual record requires a source identifier or URI", "missing_provenance");
  }
  return { sourceType, sourceId, sourceUri };
}

export function parseFileWriteInput(value) {
  const input = object(value);
  if (typeof input.content !== "string") throw new ValidationError("Invalid file content");
  if (Buffer.byteLength(input.content, "utf8") > 524_288) throw new ValidationError("File exceeds the 512 KiB write limit", "file_too_large");
  return {
    rootId: string(input.rootId || "workspace", "Root", { max: 64 }),
    path: string(input.path, "Path", { max: 1_000 }),
    content: input.content,
    expectedChecksum: optionalString(input.expectedChecksum, "Expected checksum", 128),
  };
}

export function parseMemoryInput(value) {
  const input = object(value);
  return {
    title: string(input.title, "Title", { max: 160 }),
    content: string(input.content, "Content", { max: 20_000 }),
    kind: choice(input.kind || "learning", "Memory kind", ["fact", "preference", "decision", "learning"]),
    confidence: boundedNumber(input.confidence ?? 1, "Confidence", { min: 0, max: 1 }),
    pinned: Boolean(input.pinned),
    ...provenance(input, ["file", "run", "agent", "hypothesis", "manual"]),
  };
}

export function parseHypothesisInput(value) {
  const input = object(value);
  return {
    title: string(input.title, "Title", { max: 160 }),
    statement: string(input.statement, "Statement", { max: 10_000 }),
    rationale: input.rationale ? string(input.rationale, "Rationale", { max: 10_000 }) : "",
    status: choice(input.status || "draft", "Hypothesis status", ["draft", "testing", "supported", "rejected", "inconclusive"]),
    tags: stringList(input.tags || [], "Tags", { maxItems: 24, itemMax: 48 }),
    ...provenance(input, ["file", "run", "agent", "memory", "manual"]),
  };
}

export function parseStrategyObjectiveInput(value) {
  const input = object(value);
  return {
    objective: string(input.objective, "Objective", { min: 10, max: 5_000 }),
    hypothesisId: optionalId(input.hypothesisId, "Hypothesis") || null,
    name: input.name ? string(input.name, "Name", { max: 160 }) : null,
  };
}

export function parseStrategyDefinitionInput(value) {
  const input = object(value);
  const config = object(input.config);
  const template = choice(input.template, "Strategy template", ["momentum", "mean_reversion"]);
  const parsedConfig = template === "momentum" ? {
    fastWindow: boundedNumber(config.fastWindow, "Fast window", { min: 2, max: 500, integer: true }),
    slowWindow: boundedNumber(config.slowWindow, "Slow window", { min: 3, max: 1_000, integer: true }),
    allowShort: Boolean(config.allowShort),
    signalLag: boundedNumber(config.signalLag, "Signal lag", { min: 1, max: 20, integer: true }),
  } : {
    window: boundedNumber(config.window, "Window", { min: 3, max: 1_000, integer: true }),
    entryZ: boundedNumber(config.entryZ, "Entry z-score", { min: 0.1, max: 10 }),
    exitZ: boundedNumber(config.exitZ, "Exit z-score", { min: 0, max: 10 }),
    allowShort: Boolean(config.allowShort),
    signalLag: boundedNumber(config.signalLag, "Signal lag", { min: 1, max: 20, integer: true }),
  };
  return {
    name: string(input.name, "Name", { max: 160 }), objective: string(input.objective, "Objective", { min: 10, max: 5_000 }),
    thesis: string(input.thesis, "Thesis", { min: 10, max: 10_000 }), template,
    code: string(input.code, "Code", { min: 10, max: 20_000 }), config: parsedConfig,
    hypothesisId: optionalId(input.hypothesisId, "Hypothesis") || null,
  };
}

export function parseSyntheticDatasetInput(value) {
  const input = object(value);
  return {
    seed: boundedNumber(input.seed ?? 42, "Seed", { min: 1, max: 2_147_483_647, integer: true }),
    rows: boundedNumber(input.rows ?? 756, "Rows", { min: 100, max: 5_000, integer: true }),
    symbol: string(input.symbol || "SYNTH", "Symbol", { max: 32 }).toUpperCase(),
    frequency: choice(input.frequency || "1d", "Frequency", ["1d"]),
    drift: boundedNumber(input.drift ?? 0.00025, "Drift", { min: -0.01, max: 0.01 }),
    volatility: boundedNumber(input.volatility ?? 0.012, "Volatility", { min: 0.0001, max: 0.2 }),
  };
}

export function parseBacktestInput(value) {
  const input = object(value);
  return {
    strategyVersionId: identifier(input.strategyVersionId, "Strategy version"),
    datasetSnapshotId: identifier(input.datasetSnapshotId, "Dataset snapshot"),
    config: {
      initialCapital: boundedNumber(input.initialCapital ?? 100_000, "Initial capital", { min: 100, max: 1_000_000_000 }),
      costBps: boundedNumber(input.costBps ?? 2, "Transaction cost", { min: 0, max: 1_000 }),
      slippageBps: boundedNumber(input.slippageBps ?? 1, "Slippage", { min: 0, max: 1_000 }),
      validationSeed: boundedNumber(input.validationSeed ?? 991, "Validation seed", { min: 1, max: 2_147_483_647, integer: true }),
      validationSamples: boundedNumber(input.validationSamples ?? 200, "Validation samples", { min: 50, max: 500, integer: true }),
    },
  };
}

export function parseBacktestSelectionInput(value) {
  const input = object(value);
  if (!Array.isArray(input.ids) || input.ids.length < 2 || input.ids.length > 12) throw new ValidationError("Select between 2 and 12 backtests");
  return { ids: [...new Set(input.ids.map((id) => identifier(id, "Backtest")))] };
}

export function parseExperimentInput(value) {
  const input = object(value);
  const budget = input.budget === undefined ? {} : object(input.budget);
  const score = input.score === undefined ? {} : object(input.score);
  const backtest = input.backtestConfig === undefined ? {} : object(input.backtestConfig);
  return {
    name: string(input.name, "Experiment name", { min: 2, max: 160 }),
    objective: string(input.objective, "Objective", { min: 10, max: 5_000 }),
    baseStrategyVersionId: identifier(input.baseStrategyVersionId, "Base strategy version"),
    datasetSnapshotId: identifier(input.datasetSnapshotId, "Dataset snapshot"),
    budget: {
      maxGenerations: boundedNumber(budget.maxGenerations ?? 2, "Generation budget", { min: 1, max: 20, integer: true }),
      candidatesPerGeneration: boundedNumber(budget.candidatesPerGeneration ?? 3, "Candidates per generation", { min: 1, max: 12, integer: true }),
      maxBacktests: boundedNumber(budget.maxBacktests ?? 6, "Backtest budget", { min: 1, max: 120, integer: true }),
      maxTokens: boundedNumber(budget.maxTokens ?? 0, "Experiment token budget", { min: 0, max: 20_000_000, integer: true }),
      maxCostUsd: boundedNumber(budget.maxCostUsd ?? 0, "Experiment cost budget", { min: 0, max: 50_000 }),
      maxDurationSeconds: boundedNumber(budget.maxDurationSeconds ?? 3_600, "Experiment duration budget", { min: 1, max: 86_400, integer: true }),
      patienceGenerations: boundedNumber(budget.patienceGenerations ?? 2, "Patience generations", { min: 1, max: 20, integer: true }),
      minImprovement: boundedNumber(budget.minImprovement ?? 0.001, "Minimum score improvement", { min: 0, max: 1_000 }),
    },
    score: {
      metric: choice(score.metric || "sharpe", "Score metric", ["sharpe", "sortino", "totalReturn"]),
      minTrades: boundedNumber(score.minTrades ?? 5, "Minimum trades", { min: 0, max: 10_000, integer: true }),
      maxDrawdown: boundedNumber(score.maxDrawdown ?? 0.35, "Maximum drawdown", { min: 0, max: 1 }),
      drawdownPenalty: boundedNumber(score.drawdownPenalty ?? 0.25, "Drawdown penalty", { min: 0, max: 100 }),
    },
    backtestConfig: {
      initialCapital: boundedNumber(backtest.initialCapital ?? 100_000, "Initial capital", { min: 100, max: 1_000_000_000 }),
      costBps: boundedNumber(backtest.costBps ?? 2, "Transaction cost", { min: 0, max: 1_000 }),
      slippageBps: boundedNumber(backtest.slippageBps ?? 1, "Slippage", { min: 0, max: 1_000 }),
      validationSeed: boundedNumber(backtest.validationSeed ?? 991, "Validation seed", { min: 1, max: 2_147_483_647, integer: true }),
      validationSamples: boundedNumber(backtest.validationSamples ?? 100, "Validation samples", { min: 50, max: 500, integer: true }),
    },
  };
}
