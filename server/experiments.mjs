import { randomUUID } from "node:crypto";
import { parseSafeJson, redact, safeJson } from "./security.mjs";

const terminal = new Set(["completed", "failed", "cancelled"]);
const finite = (value) => typeof value === "number" && Number.isFinite(value);

export function scoreEvaluation(metrics, scoreConfig) {
  const constraints = [];
  if (!metrics || !finite(metrics[scoreConfig.metric])) constraints.push("The score metric is missing or non-finite");
  if (!finite(metrics?.tradeCount) || metrics.tradeCount < scoreConfig.minTrades) constraints.push(`Requires at least ${scoreConfig.minTrades} trades`);
  if (!finite(metrics?.maxDrawdown) || metrics.maxDrawdown < -scoreConfig.maxDrawdown) constraints.push(`Drawdown exceeds ${scoreConfig.maxDrawdown}`);
  const eligible = constraints.length === 0;
  const raw = eligible ? metrics[scoreConfig.metric] : null;
  const score = finite(raw) ? Number((raw - Math.abs(metrics.maxDrawdown) * scoreConfig.drawdownPenalty).toFixed(8)) : null;
  return { eligible: eligible && finite(score), score: finite(score) ? score : null, constraints };
}

export function candidateParameters(base, generation, ordinal) {
  const config = structuredClone(base);
  const direction = ordinal === 0 ? 0 : ordinal % 2 ? 1 : -1;
  const magnitude = Math.ceil(ordinal / 2) * generation;
  if (config.fastWindow !== undefined) config.fastWindow = Math.max(2, config.fastWindow + direction * magnitude);
  if (config.slowWindow !== undefined) config.slowWindow = Math.max((config.fastWindow || 2) + 2, config.slowWindow + direction * magnitude * 2);
  if (config.window !== undefined) config.window = Math.max(5, config.window + direction * magnitude * 2);
  if (config.entryZ !== undefined) config.entryZ = Math.max(0.25, Number((config.entryZ + direction * magnitude * 0.1).toFixed(2)));
  return config;
}

function mapExperiment(row) {
  if (!row) return null;
  const { configJson, budgetJson, scoreJson, lessonsJson, ...rest } = row;
  return { ...rest, config: parseSafeJson(configJson), budget: parseSafeJson(budgetJson), scoreConfig: parseSafeJson(scoreJson), lessons: parseSafeJson(lessonsJson, []) };
}

function mapGeneration(row) {
  if (!row) return null;
  const { lessonsJson, ...rest } = row;
  return { ...rest, lessons: parseSafeJson(lessonsJson, []) };
}

function mapCandidate(row) {
  if (!row) return null;
  const { parametersJson, eligible, ...rest } = row;
  return { ...rest, eligible: Boolean(eligible), parameters: parseSafeJson(parametersJson) };
}

const experimentSelect = `SELECT id, name, objective, status, base_strategy_version_id AS baseStrategyVersionId,
  dataset_snapshot_id AS datasetSnapshotId, config_json AS configJson, budget_json AS budgetJson,
  score_json AS scoreJson, lessons_json AS lessonsJson, champion_candidate_id AS championCandidateId,
  generations_completed AS generationsCompleted, candidates_evaluated AS candidatesEvaluated,
  backtests_used AS backtestsUsed, tokens_used AS tokensUsed, cost_usd AS costUsd, best_score AS bestScore,
  patience_used AS patienceUsed, pause_requested_at AS pauseRequestedAt,
  cancel_requested_at AS cancelRequestedAt, error, created_at AS createdAt, started_at AS startedAt,
  updated_at AS updatedAt, finished_at AS finishedAt FROM experiments`;

export function createExperimentService({ store, backtests, maxBacktestConcurrency = 1 }) {
  const db = store.db;
  const active = new Set();
  let cpuActive = 0;
  const cpuWaiters = [];

  const cpuSlot = async (work) => {
    if (cpuActive >= maxBacktestConcurrency) await new Promise((resolve) => cpuWaiters.push(resolve));
    cpuActive += 1;
    try { return await work(); }
    finally { cpuActive -= 1; cpuWaiters.shift()?.(); }
  };

  const event = ({ experimentId, generationId = null, candidateId = null, type, level = "info", message, payload = {} }) => {
    const createdAt = store.clock();
    const result = db.prepare(`INSERT INTO experiment_events
      (experiment_id, generation_id, candidate_id, type, level, message, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(experimentId, generationId, candidateId, type, level,
        String(redact(String(message))).slice(0, 1400), safeJson(payload), createdAt);
    return Number(result.lastInsertRowid);
  };

  const get = (id, detail = true) => {
    const experiment = mapExperiment(db.prepare(`${experimentSelect} WHERE id = ?`).get(id));
    if (!experiment || !detail) return experiment;
    experiment.generations = db.prepare(`SELECT id, experiment_id AS experimentId, number, status,
      seed_candidate_id AS seedCandidateId, champion_candidate_id AS championCandidateId,
      lessons_json AS lessonsJson, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt
      FROM experiment_generations WHERE experiment_id = ? ORDER BY number`).all(id).map(mapGeneration);
    experiment.candidates = db.prepare(`SELECT id, experiment_id AS experimentId, generation_id AS generationId,
      ordinal, parent_candidate_id AS parentCandidateId, strategy_id AS strategyId, strategy_version_id AS strategyVersionId,
      backtest_id AS backtestId, name, status, parameters_json AS parametersJson, score, eligible, reason,
      created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt
      FROM experiment_candidates WHERE experiment_id = ? ORDER BY created_at, ordinal`).all(id).map(mapCandidate);
    experiment.events = db.prepare(`SELECT id, experiment_id AS experimentId, generation_id AS generationId,
      candidate_id AS candidateId, type, level, message, payload_json AS payloadJson, created_at AS createdAt
      FROM experiment_events WHERE experiment_id = ? ORDER BY id DESC LIMIT 250`).all(id)
      .map(({ payloadJson, ...row }) => ({ ...row, payload: parseSafeJson(payloadJson) }));
    return experiment;
  };

  const list = (limit = 100) => db.prepare(`${experimentSelect} ORDER BY created_at DESC LIMIT ?`)
    .all(Math.max(1, Math.min(Number(limit) || 100, 250))).map(mapExperiment);

  const create = (input, actor = "user") => {
    const base = store.getStrategyVersion(input.baseStrategyVersionId);
    const dataset = store.getDatasetSnapshot(input.datasetSnapshotId);
    if (!base || !dataset) return null;
    const id = randomUUID(); const timestamp = store.clock();
    db.prepare(`INSERT INTO experiments
      (id, name, objective, status, base_strategy_version_id, dataset_snapshot_id, config_json, budget_json, score_json, created_at, updated_at)
      VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`).run(id, input.name, input.objective,
        input.baseStrategyVersionId, input.datasetSnapshotId, safeJson(input.backtestConfig), safeJson(input.budget), safeJson(input.score), timestamp, timestamp);
    event({ experimentId: id, type: "experiment.created", message: `${input.name} created` });
    store.audit({ actor, action: "experiment.created", outcome: "success", targetType: "experiment", targetId: id });
    return get(id);
  };

  const shouldStop = (experimentId) => {
    const state = db.prepare("SELECT pause_requested_at AS pause, cancel_requested_at AS cancel FROM experiments WHERE id = ?").get(experimentId);
    return state?.cancel ? "cancelled" : state?.pause ? "paused" : null;
  };

  const ensureGeneration = (experiment, number, parent) => {
    let generation = db.prepare("SELECT * FROM experiment_generations WHERE experiment_id = ? AND number = ?").get(experiment.id, number);
    if (!generation) {
      const id = randomUUID(); const timestamp = store.clock();
      db.prepare(`INSERT INTO experiment_generations
        (id, experiment_id, number, status, seed_candidate_id, created_at) VALUES (?, ?, ?, 'queued', ?, ?)`)
        .run(id, experiment.id, number, parent?.id || null, timestamp);
      generation = db.prepare("SELECT * FROM experiment_generations WHERE id = ?").get(id);
      event({ experimentId: experiment.id, generationId: id, type: "generation.queued", message: `Generation ${number} queued` });
    }
    return generation;
  };

  const ensureCandidates = (experiment, generation, base, parent) => {
    const existing = db.prepare("SELECT id FROM experiment_candidates WHERE generation_id = ? ORDER BY ordinal").all(generation.id);
    if (existing.length) return existing.map(({ id }) => mapCandidate(db.prepare(`SELECT id, experiment_id AS experimentId, generation_id AS generationId, ordinal,
      parent_candidate_id AS parentCandidateId, strategy_id AS strategyId, strategy_version_id AS strategyVersionId, backtest_id AS backtestId,
      name, status, parameters_json AS parametersJson, score, eligible, reason, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt
      FROM experiment_candidates WHERE id = ?`).get(id)));
    const seed = parent?.parameters || base.config;
    for (let ordinal = 0; ordinal < experiment.budget.candidatesPerGeneration; ordinal += 1) {
      const id = randomUUID(); const timestamp = store.clock(); const parameters = candidateParameters(seed, generation.number, ordinal);
      db.prepare(`INSERT INTO experiment_candidates
        (id, experiment_id, generation_id, ordinal, parent_candidate_id, name, status, parameters_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?, ?)`).run(id, experiment.id, generation.id, ordinal, parent?.id || null,
          `G${generation.number} · Variant ${ordinal + 1}`, safeJson(parameters), timestamp);
    }
    return ensureCandidates(experiment, generation, base, parent);
  };

  const evaluateCandidate = async (experiment, generation, candidate, base) => {
    const current = db.prepare("SELECT status, backtest_id AS backtestId FROM experiment_candidates WHERE id = ?").get(candidate.id);
    if (current.status === "completed" || current.status === "eliminated" || current.status === "failed") return;
    if (experiment.backtestsUsed >= experiment.budget.maxBacktests) {
      db.prepare("UPDATE experiment_candidates SET status = 'eliminated', reason = ?, finished_at = ? WHERE id = ?")
        .run("Global backtest budget exhausted", store.clock(), candidate.id); return;
    }
    db.prepare("UPDATE experiment_candidates SET status = 'evaluating', started_at = COALESCE(started_at, ?) WHERE id = ?")
      .run(store.clock(), candidate.id);
    try {
      let strategyVersionId = candidate.strategyVersionId;
      if (!strategyVersionId) {
        const strategy = store.createStrategy({ ...base, name: `${base.name} · ${candidate.name}`, config: candidate.parameters, hypothesisId: base.hypothesisId }, "experiment");
        strategyVersionId = strategy.versionId;
        db.prepare("UPDATE experiment_candidates SET strategy_id = ?, strategy_version_id = ? WHERE id = ?").run(strategy.id, strategy.versionId, candidate.id);
      }
      let backtestId = current.backtestId;
      if (!backtestId || store.getBacktest(backtestId)?.status === "failed") {
        const queued = store.createBacktest({ strategyVersionId, datasetSnapshotId: experiment.datasetSnapshotId, config: experiment.config }, "experiment");
        backtestId = queued.id;
        db.prepare("UPDATE experiment_candidates SET backtest_id = ? WHERE id = ?").run(backtestId, candidate.id);
        db.prepare("UPDATE experiments SET backtests_used = backtests_used + 1, updated_at = ? WHERE id = ?").run(store.clock(), experiment.id);
      }
      const result = store.getBacktest(backtestId).status === "completed" ? store.getBacktest(backtestId) : await cpuSlot(() => backtests.execute(backtestId));
      const evaluation = scoreEvaluation(result.metrics, experiment.scoreConfig);
      db.prepare(`INSERT INTO experiment_evaluations
        (id, candidate_id, backtest_id, score, eligible, metrics_json, constraints_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(candidate_id) DO NOTHING`).run(randomUUID(), candidate.id, backtestId, evaluation.score, evaluation.eligible ? 1 : 0,
          safeJson(result.metrics || {}), safeJson(evaluation.constraints), store.clock());
      db.prepare(`UPDATE experiment_candidates SET status = ?, score = ?, eligible = ?, reason = ?, finished_at = ? WHERE id = ?`)
        .run(evaluation.eligible ? "completed" : "eliminated", evaluation.score, evaluation.eligible ? 1 : 0,
          evaluation.constraints.join("; ") || null, store.clock(), candidate.id);
      db.prepare("UPDATE experiments SET candidates_evaluated = candidates_evaluated + 1, updated_at = ? WHERE id = ?").run(store.clock(), experiment.id);
      event({ experimentId: experiment.id, generationId: generation.id, candidateId: candidate.id, type: "candidate.evaluated",
        level: evaluation.eligible ? "info" : "warning", message: `${candidate.name} evaluated`, payload: evaluation });
    } catch (error) {
      const reason = String(redact(String(error?.message || error))).slice(-1400);
      db.prepare("UPDATE experiment_candidates SET status = 'failed', reason = ?, finished_at = ? WHERE id = ?").run(reason, store.clock(), candidate.id);
      event({ experimentId: experiment.id, generationId: generation.id, candidateId: candidate.id, type: "candidate.failed", level: "error", message: reason });
    }
  };

  const run = async (id) => {
    if (active.has(id)) return;
    active.add(id);
    try {
      let experiment = get(id);
      if (!experiment || terminal.has(experiment.status)) return;
      db.prepare(`UPDATE experiments SET status = 'running', pause_requested_at = NULL,
        started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`).run(store.clock(), store.clock(), id);
      event({ experimentId: id, type: "experiment.started", message: "Experiment loop started" });
      const base = store.getStrategyVersion(experiment.baseStrategyVersionId);
      let parent = experiment.championCandidateId ? experiment.candidates.find((item) => item.id === experiment.championCandidateId) : null;
      let bestScore = experiment.bestScore ?? Number.NEGATIVE_INFINITY;
      let patienceUsed = experiment.patienceUsed;
      for (let number = experiment.generationsCompleted + 1; number <= experiment.budget.maxGenerations; number += 1) {
        experiment = get(id);
        const runtimeSeconds = Math.max(0, (Date.parse(store.clock()) - Date.parse(experiment.startedAt)) / 1_000);
        if (runtimeSeconds >= experiment.budget.maxDurationSeconds) {
          event({ experimentId: id, type: "experiment.duration_exhausted", level: "warning", message: "Experiment duration budget exhausted", payload: { runtimeSeconds } });
          break;
        }
        const stop = shouldStop(id);
        if (stop) {
          db.prepare("UPDATE experiments SET status = ?, updated_at = ?, finished_at = CASE WHEN ? = 'cancelled' THEN ? ELSE finished_at END WHERE id = ?")
            .run(stop, store.clock(), stop, store.clock(), id);
          event({ experimentId: id, type: `experiment.${stop}`, level: "warning", message: `Experiment ${stop}` }); return;
        }
        const generation = ensureGeneration(experiment, number, parent);
        db.prepare("UPDATE experiment_generations SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?").run(store.clock(), generation.id);
        const candidates = ensureCandidates(experiment, generation, base, parent);
        for (const candidate of candidates) {
          const live = get(id, false);
          if (live.backtestsUsed >= live.budget.maxBacktests || shouldStop(id)) break;
          await evaluateCandidate(live, generation, candidate, base);
        }
        const ranked = db.prepare(`SELECT id, score, ordinal, parameters_json AS parametersJson FROM experiment_candidates
          WHERE generation_id = ? AND eligible = 1 AND score IS NOT NULL ORDER BY score DESC, ordinal ASC`).all(generation.id).map(mapCandidate);
        const champion = ranked[0] || null;
        const lessons = champion ? [`Generation ${number}: ${champion.id} leads with score ${champion.score}.`] : [`Generation ${number}: no eligible candidate.`];
        db.prepare(`UPDATE experiment_generations SET status = ?, champion_candidate_id = ?, lessons_json = ?, finished_at = ? WHERE id = ?`)
          .run(champion ? "completed" : "failed", champion?.id || null, safeJson(lessons), store.clock(), generation.id);
        db.prepare(`UPDATE experiments SET generations_completed = ?, champion_candidate_id = COALESCE(?, champion_candidate_id),
          lessons_json = ?, updated_at = ? WHERE id = ?`).run(number, champion?.id || null,
          safeJson([...get(id, false).lessons, ...lessons]), store.clock(), id);
        event({ experimentId: id, generationId: generation.id, type: "generation.completed", level: champion ? "info" : "warning",
          message: `Generation ${number} ${champion ? "completed" : "has no eligible candidate"}`, payload: { championCandidateId: champion?.id || null } });
        parent = champion || parent;
        if (champion) {
          if (champion.score > bestScore + experiment.budget.minImprovement) { bestScore = champion.score; patienceUsed = 0; }
          else patienceUsed += 1;
        }
        db.prepare("UPDATE experiments SET best_score = ?, patience_used = ?, updated_at = ? WHERE id = ?")
          .run(Number.isFinite(bestScore) ? bestScore : null, patienceUsed, store.clock(), id);
        if (patienceUsed >= experiment.budget.patienceGenerations) {
          event({ experimentId: id, generationId: generation.id, type: "experiment.patience_exhausted", level: "warning",
            message: "Experiment stopped after no material score improvement", payload: { patienceUsed, bestScore } });
          break;
        }
        if (!champion || get(id, false).backtestsUsed >= experiment.budget.maxBacktests) break;
      }
      const final = get(id, false);
      db.prepare("UPDATE experiments SET status = 'completed', updated_at = ?, finished_at = ? WHERE id = ?")
        .run(store.clock(), store.clock(), id);
      event({ experimentId: id, type: "experiment.completed", message: final.championCandidateId ? "Experiment completed with a research champion" : "Experiment completed without an eligible champion",
        payload: { championCandidateId: final.championCandidateId, paperPromoted: false, livePromoted: false } });
    } catch (error) {
      const reason = String(redact(String(error?.message || error))).slice(-1400);
      db.prepare("UPDATE experiments SET status = 'failed', error = ?, updated_at = ?, finished_at = ? WHERE id = ?").run(reason, store.clock(), store.clock(), id);
      event({ experimentId: id, type: "experiment.failed", level: "error", message: reason });
    } finally { active.delete(id); }
  };

  const start = (id) => {
    const experiment = get(id, false);
    if (!experiment || terminal.has(experiment.status) || experiment.status === "running") return false;
    db.prepare("UPDATE experiments SET status = 'queued', pause_requested_at = NULL, updated_at = ? WHERE id = ?").run(store.clock(), id);
    queueMicrotask(() => run(id));
    return true;
  };
  const pause = (id) => db.prepare(`UPDATE experiments SET pause_requested_at = ?, updated_at = ?
    WHERE id = ? AND status IN ('queued', 'running') AND pause_requested_at IS NULL`).run(store.clock(), store.clock(), id).changes > 0;
  const cancel = (id) => {
    const timestamp = store.clock();
    const state = db.prepare("SELECT status FROM experiments WHERE id = ?").get(id);
    if (!state || terminal.has(state.status)) return false;
    if (["draft", "paused"].includes(state.status)) {
      const changed = db.prepare("UPDATE experiments SET status = 'cancelled', cancel_requested_at = ?, updated_at = ?, finished_at = ? WHERE id = ?")
        .run(timestamp, timestamp, timestamp, id).changes > 0;
      if (changed) event({ experimentId: id, type: "experiment.cancelled", level: "warning", message: "Experiment cancelled" });
      return changed;
    }
    return db.prepare(`UPDATE experiments SET cancel_requested_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('queued', 'running') AND cancel_requested_at IS NULL`).run(timestamp, timestamp, id).changes > 0;
  };
  const recover = () => {
    const stale = db.prepare("SELECT id FROM experiments WHERE status IN ('queued', 'running')").all();
    db.prepare("UPDATE experiment_candidates SET status = 'queued' WHERE status = 'evaluating'").run();
    db.prepare("UPDATE experiments SET status = 'queued', updated_at = ? WHERE status = 'running'").run(store.clock());
    for (const { id } of stale) queueMicrotask(() => run(id));
    return stale.length;
  };

  return { create, get, list, start, pause, cancel, recover, run, activeCount: () => active.size, cpuActiveCount: () => cpuActive };
}
