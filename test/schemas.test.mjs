import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChatInput, parseConversationInput, ValidationError } from "../server/schemas.mjs";

test("chat schema accepts only bounded known values", () => {
  assert.deepEqual(parseChatInput({ agent: "codex", mode: "build", message: "  hello  " }), {
    agent: "codex",
    mode: "build",
    message: "hello",
    conversationId: "",
    legacySessionId: "",
  });
  assert.throws(() => parseChatInput({ agent: "unknown", message: "hello" }), ValidationError);
  assert.throws(() => parseChatInput({ agent: "pi", message: "" }), /Message vide/);
  assert.throws(() => parseChatInput({ agent: "pi", message: "x".repeat(16_001) }), /trop long/);
  assert.throws(() => parseChatInput({ agent: "pi", message: "ok", conversationId: "../escape" }), /Conversation invalide/);
});

test("conversation schema supplies an honest empty title", () => {
  assert.deepEqual(parseConversationInput({ agent: "pi" }), { agent: "pi", title: "Nouvelle conversation" });
  assert.throws(() => parseConversationInput({ agent: "pi", title: "x".repeat(121) }), /trop long/);
});
