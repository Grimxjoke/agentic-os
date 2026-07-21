import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createBacktestService } from "../server/backtest-service.mjs";
import { BacktestError, calculateMetrics, compareBacktests, createSyntheticDataset, runBacktest, strategyFromObjective, validateDataset, validateResults } from "../server/backtests.mjs";
import { openDatabase } from "../server/database.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

const runConfig = { initialCapital: 100_000, costBps: 2, slippageBps: 1, validationSeed: 991, validationSamples: 100 };

test("synthetic data and backtest results are deterministic without network access", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network access is forbidden"); };
  try {
    const datasetA = createSyntheticDataset({ seed: 77, rows: 500 });
    const datasetB = createSyntheticDataset({ seed: 77, rows: 500 });
    assert.equal(datasetA.checksum, datasetB.checksum);
    assert.deepEqual(datasetA.data, datasetB.data);
    const generated = strategyFromObjective("Capture durable price momentum after costs");
    const first = runBacktest({ strategy: generated, dataset: datasetA, runConfig });
    const second = runBacktest({ strategy: generated, dataset: datasetB, runConfig });
    assert.deepEqual(first, second);
    assert.ok(Number.isFinite(first.metrics.sharpe));
    assert.equal(validateResults(first, { samples: 100 }).length, 4);
  } finally { globalThis.fetch = originalFetch; }
});

test("known metrics include exact return, drawdown, win rate and profit factor", () => {
  const metrics = calculateMetrics([0, 0.1, -0.2, 0.05], [100, 110, 88, 92.4], [
    { pnl: 0.1 }, { pnl: -0.2 }, { pnl: 0.05 },
  ], "1d", 3);
  assert.equal(metrics.totalReturn, -0.076);
  assert.equal(metrics.maxDrawdown, -0.2);
  assert.equal(metrics.winRate, 0.66666667);
  assert.equal(metrics.profitFactor, 0.75);
  assert.equal(metrics.tradeCount, 3);
  assert.equal(metrics.exposure, 0.75);
  assert.equal(calculateMetrics([0, 0.1], [100, 110], [{ pnl: 0.1 }], "1d", 1).profitFactor, null);
});

test("lookahead configurations and corrupted chronological data fail closed", () => {
  const dataset = createSyntheticDataset({ seed: 9, rows: 200 });
  const strategy = strategyFromObjective("Follow long-term momentum");
  assert.throws(() => runBacktest({ strategy: { ...strategy, config: { ...strategy.config, signalLag: 0 } }, dataset, runConfig }), (error) => error instanceof BacktestError && error.code === "lookahead_risk");
  const corrupted = structuredClone(dataset.data);
  corrupted[40].timestamp = corrupted[39].timestamp;
  assert.throws(() => validateDataset(corrupted), (error) => error.code === "lookahead_risk");
  corrupted[40] = { ...corrupted[40], timestamp: new Date(Date.parse(corrupted[39].timestamp) + 86_400_000).toISOString(), close: Number.NaN };
  assert.throws(() => validateDataset(corrupted), (error) => error.code === "corrupted_dataset");
});

test("comparison rejects incompatible dataset and cost snapshots", () => {
  const base = { id: "a", status: "completed", metrics: { sharpe: 1 }, strategySnapshot: { name: "A" }, dataSnapshot: { checksum: "one" }, config: runConfig, returns: [0, 0.1] };
  assert.throws(() => compareBacktests([base, { ...base, id: "b", dataSnapshot: { checksum: "two" } }]), (error) => error.code === "incompatible_comparison");
  assert.throws(() => compareBacktests([base, { ...base, id: "b", config: { ...runConfig, costBps: 9 } }]), (error) => error.code === "incompatible_comparison");
  assert.deepEqual(compareBacktests([base, { ...base, id: "b", metrics: { sharpe: 2 }, strategySnapshot: { name: "B" } }]).map((item) => item.id), ["b", "a"]);
});

test("persistent backtests preserve snapshots and detect missing or corrupted report artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orbit-backtest-test-"));
  const opened = await openDatabase({ dataDirectory: directory });
  try {
    const store = new ControlPlaneStore(opened.db, () => "2026-07-17T16:00:00.000Z");
    const hypothesis = store.createHypothesis({ title: "Momentum persistence", statement: "Lagged momentum persists after costs.", rationale: "Test fixture", status: "testing", tags: ["momentum"], sourceType: "manual", sourceId: null, sourceUri: null });
    const generated = strategyFromObjective("Capture momentum using completed bars");
    const strategy = store.createStrategy({ ...generated, objective: "Capture momentum using completed bars", hypothesisId: hypothesis.id });
    assert.equal(store.listStrategyVersions(strategy.id).length, 1);
    assert.throws(() => opened.db.prepare("UPDATE strategy_versions SET name = 'Mutated' WHERE id = ?").run(strategy.versionId), /immutable/);
    const dataset = store.createDatasetSnapshot(createSyntheticDataset({ seed: 123, rows: 300 }));
    const queued = store.createBacktest({ strategyVersionId: strategy.versionId, datasetSnapshotId: dataset.id, config: runConfig });
    const service = createBacktestService({ store, dataDirectory: directory });
    const completed = await service.execute(queued.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.strategySnapshot.versionId, strategy.versionId);
    assert.equal(completed.hypothesisId, hypothesis.id);
    assert.equal(completed.dataSnapshot.checksum, dataset.checksum);
    assert.equal(completed.validations.length, 4);
    const graph = store.knowledgeGraph();
    assert.ok(graph.edges.some((edge) => edge.source === `backtest:${completed.id}` && edge.target === `strategy:${strategy.id}`));
    assert.ok(graph.edges.some((edge) => edge.source === `backtest:${completed.id}` && edge.target === `hypothesis:${hypothesis.id}`));
    assert.equal((await service.detail(completed.id)).artifact.status, "available");

    const reportPath = join(directory, "backtest-artifacts", completed.id, "report.json");
    await writeFile(reportPath, "corrupted");
    assert.equal((await service.detail(completed.id)).artifact.status, "corrupted");
    await rm(reportPath);
    assert.equal((await service.detail(completed.id)).artifact.status, "missing");
  } finally {
    opened.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
