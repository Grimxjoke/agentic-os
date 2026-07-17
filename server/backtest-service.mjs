import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { checksum, compareBacktests, correlationMatrix, runBacktest, validateResults } from "./backtests.mjs";

export function createBacktestService({ store, dataDirectory }) {
  const artifactsDirectory = join(dataDirectory, "backtest-artifacts");

  async function writeArtifact(backtest, result, validations) {
    const directory = join(artifactsDirectory, backtest.id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, "report.json");
    const temporary = join(directory, `.report.${randomUUID()}.tmp`);
    const report = JSON.stringify({
      schema: 1, backtestId: backtest.id, strategy: backtest.strategySnapshot, dataset: backtest.dataSnapshot,
      config: backtest.config, metrics: result.metrics, warnings: result.warnings, validations,
      equity: result.equity, returns: result.returns, trades: result.trades,
    });
    await writeFile(temporary, report, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
    await chmod(path, 0o600);
    return { uri: `artifact://backtests/${backtest.id}/report.json`, checksum: checksum(report), path };
  }

  async function execute(id) {
    const backtest = store.getBacktest(id);
    if (!backtest) return null;
    if (!store.startBacktest(id)) return store.getBacktest(id);
    try {
      const dataset = store.getDatasetSnapshot(backtest.datasetSnapshotId, true);
      const result = runBacktest({ strategy: backtest.strategySnapshot, dataset, runConfig: backtest.config });
      const validations = validateResults(result, { frequency: dataset.frequency, seed: backtest.config.validationSeed || 991, samples: backtest.config.validationSamples || 200 });
      const artifact = await writeArtifact(backtest, result, validations);
      store.completeBacktest(id, result, artifact, validations);
      return store.getBacktest(id);
    } catch (error) {
      store.failBacktest(id, error?.message || error);
      return store.getBacktest(id);
    }
  }

  async function inspectArtifact(backtest) {
    if (!backtest?.artifactUri || !backtest.artifactChecksum) return { status: "missing", detail: "No report artifact was recorded." };
    const path = join(artifactsDirectory, backtest.id, "report.json");
    try {
      const content = await readFile(path, "utf8");
      if (checksum(content) !== backtest.artifactChecksum) return { status: "corrupted", detail: "Report checksum does not match the recorded artifact." };
      return { status: "available", bytes: (await stat(path)).size, checksum: backtest.artifactChecksum };
    } catch (error) {
      if (error.code === "ENOENT") return { status: "missing", detail: "The report artifact is missing from durable storage." };
      throw error;
    }
  }

  async function detail(id) {
    const backtest = store.getBacktest(id);
    return backtest ? { ...backtest, artifact: await inspectArtifact(backtest) } : null;
  }

  function comparison(ids) {
    return compareBacktests(ids.map((id) => store.getBacktest(id)).filter(Boolean));
  }

  function correlations(ids) {
    return correlationMatrix(ids.map((id) => store.getBacktest(id)).filter(Boolean));
  }

  return { execute, detail, comparison, correlations, inspectArtifact };
}
