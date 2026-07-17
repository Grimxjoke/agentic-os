import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAgentDefinitionInput, parseChatInput, parseConversationInput, parseTeamDefinitionInput, ValidationError } from "../server/schemas.mjs";

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

test("agent definitions bound budgets and keep trading denied", () => {
  const parsed = parseAgentDefinitionInput({
    name: " Heron ", role: " Researcher ", instructions: " Reproduce results ", model: "gpt-5.4",
    tools: ["python", "python"], budget: { maxTokens: 2000, maxDurationMinutes: 5, maxRetries: 0, maxCostUsd: 0 },
  });
  assert.equal(parsed.name, "Heron");
  assert.deepEqual(parsed.tools, ["python"]);
  assert.equal(parsed.policy.trading, "deny");
  assert.throws(() => parseAgentDefinitionInput({ ...parsed, budget: { ...parsed.budget, maxRetries: 11 } }), /Budget retries invalide/);
  assert.throws(() => parseAgentDefinitionInput({ ...parsed, policy: { ...parsed.policy, trading: "allow" } }), /Policy trading invalide/);
});

test("conversation schema supplies an honest empty title", () => {
  assert.deepEqual(parseConversationInput({ agent: "pi" }), { agent: "pi", title: "Nouvelle conversation" });
  assert.throws(() => parseConversationInput({ agent: "pi", title: "x".repeat(121) }), /trop long/);
});

test("team definitions accept a DAG and reject cycles or excess concurrency", () => {
  const agentVersionId = "11111111-1111-4111-8111-111111111111";
  const valid = {
    name: "Research desk", maxConcurrency: 2,
    nodes: [
      { key: "research", label: "Research", agentVersionId, task: "Research data", dependsOn: [] },
      { key: "review", label: "Review", agentVersionId, task: "Review result", dependsOn: ["research"] },
    ],
  };
  assert.equal(parseTeamDefinitionInput(valid).nodes.length, 2);
  assert.throws(() => parseTeamDefinitionInput({ ...valid, maxConcurrency: 3 }), /Concurrence invalide/);
  assert.throws(() => parseTeamDefinitionInput({ ...valid, nodes: [
    { ...valid.nodes[0], dependsOn: ["review"] }, valid.nodes[1],
  ] }), (error) => error.code === "cyclic_team");
  assert.throws(() => parseTeamDefinitionInput({ ...valid, nodes: [{ ...valid.nodes[0], dependsOn: ["missing"] }] }), (error) => error.code === "unknown_dependency");
});
