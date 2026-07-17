import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../server/database.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

test("memories and hypotheses retain provenance and derive only valid graph links", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orbit-knowledge-test-"));
  const opened = await openDatabase({ dataDirectory: directory });
  try {
    const store = new ControlPlaneStore(opened.db, () => "2026-07-17T15:00:00.000Z");
    store.replaceFileArtifactIndex([{ rootId: "workspace", path: "research/alpha.md", name: "alpha.md", kind: "document", mimeType: "text/markdown", bytes: 42 }]);
    const hypothesis = store.createHypothesis({
      title: "Volatility breakout", statement: "Expansion after compression has positive expectancy.", rationale: "Test on an untouched sample.",
      status: "testing", tags: ["volatility"], sourceType: "file", sourceId: "workspace:research/alpha.md", sourceUri: "/files?path=research%2Falpha.md",
    });
    const memory = store.createMemory({
      title: "Prefer untouched test periods", content: "Never tune on the final period.", kind: "decision", confidence: 0.95,
      pinned: true, sourceType: "hypothesis", sourceId: hypothesis.id, sourceUri: "/knowledge",
    });
    assert.equal(store.getMemory(memory.id).sourceId, hypothesis.id);
    assert.equal(store.listHypotheses({ query: "breakout" })[0].tags[0], "volatility");
    const graph = store.knowledgeGraph();
    assert.ok(graph.nodes.some((node) => node.id === `hypothesis:${hypothesis.id}`));
    assert.ok(graph.edges.some((edge) => edge.source === `memory:${memory.id}` && edge.target === `hypothesis:${hypothesis.id}`));
    assert.ok(graph.edges.every((edge) => graph.nodes.some((node) => node.id === edge.source) && graph.nodes.some((node) => node.id === edge.target)));
    assert.equal(store.archiveMemory(memory.id), true);
    assert.equal(store.getMemory(memory.id), null);
  } finally {
    opened.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
