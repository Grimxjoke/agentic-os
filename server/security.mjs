import { createHash, timingSafeEqual } from "node:crypto";

const sensitiveKey = /(^|_)(access_?token|session_?token|authorization|cookie|secret|password|api_?key|private_?key)($|_)/i;
const bearerLike = /\b(?:bearer\s+)?(?:sk-[a-z0-9_-]{12,}|[a-z0-9_-]{32,})\b/gi;

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
