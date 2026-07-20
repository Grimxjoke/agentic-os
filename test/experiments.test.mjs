import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSyntheticDataset, strategyFromObjective } from "../server/backtests.mjs";
import { candidateParameters, createExperimentService, scoreEvaluation } from "../server/experiments.mjs";
import { openDatabase, schemaVersion } from "../server/database.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

const inputFor = (strategy, dataset, budget = {}) => ({
  name: "Deterministic search", objective: "Find a robust challenger without any trading promotion",
  baseStrategyVersionId: strategy.versionId, datasetSnapshotId: dataset.id,
  budget: { maxGenerations: 2, candidatesPerGeneration: 3, maxBacktests: 6, maxTokens: 0, maxCostUsd: 0, maxDurationSeconds: 3600, patienceGenerations: 2, minImprovement: 0.001, ...budget },
  score: { metric: "sharpe", minTrades: 1, maxDrawdown: 0.5, drawdownPenalty: 0.25 },
  backtestConfig: { initialCapital: 100_000, costBps: 2, slippageBps: 1, validationSeed: 991, validationSamples: 50 },
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "orbit-experiment-test-"));
  const opened = await openDatabase({ dataDirectory: directory });
  let tick = 0;
  const store = new ControlPlaneStore(opened.db, () => new Date(Date.UTC(2026, 6, 18, 0, 0, tick++)).toISOString());
  const base = strategyFromObjective("Capture durable momentum after costs");
  const strategy = store.createStrategy({ ...base, objective: "Capture durable momentum after costs", hypothesisId: null });
  const dataset = store.createDatasetSnapshot(createSyntheticDataset({ seed: 77, rows: 120 }));
  const fakeBacktests = { execute: async (id) => {
    const queued = store.getBacktest(id); store.startBacktest(id);
    const variant = Number(queued.strategySnapshot.config.fastWindow || queued.strategySnapshot.config.window || 0);
    const metrics = { totalReturn: 0.1, annualizedReturn: 0.1, annualizedVolatility: 0.1, sharpe: 1 + variant / 100,
      sortino: 1.2, maxDrawdown: -0.1, winRate: 0.5, profitFactor: 1.2, tradeCount: 12, exposure: 0.5, endingEquity: 110_000 };
    store.completeBacktest(id, { metrics, warnings: [], equity: [100_000, 110_000], returns: [0, 0.1], trades: [] },
      { uri: `test://${id}`, checksum: id }, []);
    return store.getBacktest(id);
  } };
  return { directory, opened, store, strategy, dataset, service: createExperimentService({ store, backtests: fakeBacktests, maxBacktestConcurrency: 1 }) };
}

test("schema v6 creates a deterministic two-generation, three-candidate research loop", async () => {
  const context = await fixture();
  try {
    assert.equal(schemaVersion(context.opened.db), 6);
    const experiment = context.service.create(inputFor(context.strategy, context.dataset));
    await context.service.run(experiment.id);
    const completed = context.service.get(experiment.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.generations.length, 2);
    assert.equal(completed.candidates.length, 6);
    assert.equal(completed.candidatesEvaluated, 6);
    assert.equal(completed.backtestsUsed, 6);
    assert.ok(completed.championCandidateId);
    assert.equal(context.store.listBacktests().length, 6);
    assert.equal(context.opened.db.prepare("SELECT COUNT(*) AS count FROM experiment_evaluations").get().count, 6);
    const completion = completed.events.find((event) => event.type === "experiment.completed");
    assert.deepEqual(completion.payload, { championCandidateId: completed.championCandidateId, paperPromoted: false, livePromoted: false });
  } finally { context.opened.db.close(); await rm(context.directory, { recursive: true, force: true }); }
});

test("global backtest budget stops candidate evaluation without overspending", async () => {
  const context = await fixture();
  try {
    const experiment = context.service.create(inputFor(context.strategy, context.dataset, { maxBacktests: 4 }));
    await context.service.run(experiment.id);
    const completed = context.service.get(experiment.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.backtestsUsed, 4);
    assert.equal(completed.candidatesEvaluated, 4);
    assert.equal(context.store.listBacktests().length, 4);
  } finally { context.opened.db.close(); await rm(context.directory, { recursive: true, force: true }); }
});

test("duration and patience budgets stop the loop at durable generation boundaries", async () => {
  const context = await fixture();
  try {
    const patient = context.service.create(inputFor(context.strategy, context.dataset, { maxGenerations: 3, maxBacktests: 9, patienceGenerations: 1, minImprovement: 100 }));
    await context.service.run(patient.id);
    const stopped = context.service.get(patient.id);
    assert.equal(stopped.generationsCompleted, 2);
    assert.ok(stopped.events.some((event) => event.type === "experiment.patience_exhausted"));

    const timed = context.service.create(inputFor(context.strategy, context.dataset, { maxDurationSeconds: 1 }));
    await context.service.run(timed.id);
    const expired = context.service.get(timed.id);
    assert.equal(expired.generationsCompleted, 0);
    assert.equal(expired.backtestsUsed, 0);
    assert.ok(expired.events.some((event) => event.type === "experiment.duration_exhausted"));
  } finally { context.opened.db.close(); await rm(context.directory, { recursive: true, force: true }); }
});

test("scoring fails closed for incomplete metrics and resolves ties by candidate order", async () => {
  assert.deepEqual(scoreEvaluation({ sharpe: Number.NaN, tradeCount: 9, maxDrawdown: -0.1 }, { metric: "sharpe", minTrades: 1, maxDrawdown: 0.5, drawdownPenalty: 0 }),
    { eligible: false, score: null, constraints: ["The score metric is missing or non-finite"] });
  assert.equal(scoreEvaluation({ sharpe: 2, tradeCount: 0, maxDrawdown: -0.7 }, { metric: "sharpe", minTrades: 2, maxDrawdown: 0.5, drawdownPenalty: 0 }).eligible, false);
  assert.deepEqual(candidateParameters({ fastWindow: 10, slowWindow: 30, signalLag: 1 }, 1, 0), { fastWindow: 10, slowWindow: 30, signalLag: 1 });
  assert.deepEqual(candidateParameters({ fastWindow: 10, slowWindow: 30, signalLag: 1 }, 1, 1), { fastWindow: 11, slowWindow: 32, signalLag: 1 });
});

test("recovery requeues an interrupted candidate and remains idempotent after completion", async () => {
  const context = await fixture();
  try {
    const experiment = context.service.create(inputFor(context.strategy, context.dataset, { maxGenerations: 1, candidatesPerGeneration: 1, maxBacktests: 1 }));
    context.opened.db.prepare("UPDATE experiments SET status = 'running' WHERE id = ?").run(experiment.id);
    const generationId = "00000000-0000-4000-8000-000000000001";
    const candidateId = "00000000-0000-4000-8000-000000000002";
    context.opened.db.prepare("INSERT INTO experiment_generations(id, experiment_id, number, status, created_at) VALUES (?, ?, 1, 'running', ?)").run(generationId, experiment.id, context.store.clock());
    context.opened.db.prepare(`INSERT INTO experiment_candidates
      (id, experiment_id, generation_id, ordinal, name, status, parameters_json, created_at) VALUES (?, ?, ?, 0, 'Recovered', 'evaluating', ?, ?)`)
      .run(candidateId, experiment.id, generationId, JSON.stringify(context.strategy.config), context.store.clock());
    assert.equal(context.service.recover(), 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (context.service.get(experiment.id, false).status !== "completed") await context.service.run(experiment.id);
    const completed = context.service.get(experiment.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.candidates[0].status, "completed");
    const eventCount = completed.events.length;
    await context.service.run(experiment.id);
    assert.equal(context.service.get(experiment.id).events.length, eventCount);
  } finally { context.opened.db.close(); await rm(context.directory, { recursive: true, force: true }); }
});
