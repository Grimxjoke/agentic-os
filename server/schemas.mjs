export class ValidationError extends Error {
  constructor(message, code = "invalid_request") {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Objet JSON attendu");
  return value;
}

function string(value, name, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string") throw new ValidationError(`${name} invalide`);
  const normalized = value.trim();
  if (normalized.length < min) throw new ValidationError(`${name} vide`);
  if (normalized.length > max) throw new ValidationError(`${name} trop long (${max} caractères maximum)`);
  return normalized;
}

function optionalId(value, name) {
  if (value === undefined || value === null || value === "") return "";
  const id = string(value, name, { max: 64 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError(`${name} invalide`);
  return id;
}

function boundedNumber(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new ValidationError(`${name} invalide`);
  }
  return value;
}

function stringList(value, name, { maxItems = 32, itemMax = 80 } = {}) {
  if (!Array.isArray(value) || value.length > maxItems) throw new ValidationError(`${name} invalide`);
  return [...new Set(value.map((item) => string(item, name, { max: itemMax })))];
}

function choice(value, name, choices) {
  if (!choices.includes(value)) throw new ValidationError(`${name} invalide`);
  return value;
}

export function parseChatInput(value) {
  const input = object(value);
  const agent = input.agent === "pi" || input.agent === "codex" ? input.agent : "";
  if (!agent) throw new ValidationError("Agent invalide");
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
  if (!agent) throw new ValidationError("Agent invalide");
  return { agent, title: input.title ? string(input.title, "Titre", { max: 120 }) : "Nouvelle conversation" };
}

export function parseAgent(value) {
  if (value === "pi" || value === "codex") return value;
  throw new ValidationError("Agent invalide");
}

export function parseAgentDefinitionInput(value) {
  const input = object(value);
  const budget = input.budget === undefined ? {} : object(input.budget);
  const policy = input.policy === undefined ? {} : object(input.policy);
  return {
    name: string(input.name, "Nom", { min: 2, max: 80 }),
    role: string(input.role, "Rôle", { min: 2, max: 120 }),
    description: input.description ? string(input.description, "Description", { max: 1_000 }) : "",
    instructions: string(input.instructions, "Instructions", { max: 16_000 }),
    provider: string(input.provider || "openai-codex", "Provider", { max: 80 }),
    model: string(input.model, "Modèle", { max: 120 }),
    tools: stringList(input.tools || [], "Outils"),
    skills: stringList(input.skills || [], "Skills"),
    budget: {
      maxTokens: boundedNumber(budget.maxTokens ?? 100_000, "Budget tokens", { min: 1_000, max: 10_000_000, integer: true }),
      maxCostUsd: boundedNumber(budget.maxCostUsd ?? 0, "Budget coût", { min: 0, max: 10_000 }),
      maxDurationMinutes: boundedNumber(budget.maxDurationMinutes ?? 30, "Budget durée", { min: 1, max: 1_440, integer: true }),
      maxRetries: boundedNumber(budget.maxRetries ?? 1, "Budget retries", { min: 0, max: 10, integer: true }),
    },
    policy: {
      filesystem: choice(policy.filesystem || "read", "Policy filesystem", ["deny", "read", "write"]),
      network: choice(policy.network || "allow", "Policy réseau", ["deny", "allow"]),
      trading: choice(policy.trading || "deny", "Policy trading", ["deny"]),
    },
    color: choice(input.color || "cyan", "Couleur", ["cyan", "violet", "rose", "amber"]),
  };
}
