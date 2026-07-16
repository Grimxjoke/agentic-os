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
