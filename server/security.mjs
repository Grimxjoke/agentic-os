import { createHash, timingSafeEqual } from "node:crypto";

const sensitiveKey = /(^|_)(access_?token|session_?token|authorization|cookie|secret|password|api_?key|private_?key)($|_)/i;
const bearerLike = /\b(?:bearer\s+[a-z0-9._~+/-]{12,}|sk-[a-z0-9_-]{12,}|(?![0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b)[a-z0-9_-]{32,})\b/gi;

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function constantTimeTextEqual(left = "", right = "") {
  const expected = Buffer.from(String(right));
  const actual = Buffer.from(String(left));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function redact(value, key = "") {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (/checksum$/i.test(key) && typeof value === "string" && /^[0-9a-f]{64}$/i.test(value)) return value;
  if (typeof value === "string") return value.replace(bearerLike, "[REDACTED]");
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]));
  }
  return value;
}

export function safeJson(value = {}) {
  return JSON.stringify(redact(value));
}

export function parseSafeJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return redact(JSON.parse(value));
  } catch {
    return fallback;
  }
}
