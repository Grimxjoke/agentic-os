import { useCallback, useEffect, useState } from "react";
import { Beaker, Braces, CheckCircle2, Database, FlaskConical, Link2, Play, Plus, RefreshCw, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { BacktestRecord, DatasetSnapshot, HypothesisRecord, StrategyDefinition } from "../types";

export function StrategyFactoryPage() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<DatasetSnapshot[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisRecord[]>([]);
  const [objective, setObjective] = useState("Capture medium-term price momentum using only completed daily bars, with explicit costs and controlled drawdown.");
  const [hypothesisId, setHypothesisId] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [seed, setSeed] = useState(42);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [strategyResponse, datasetResponse, hypothesisResponse] = await Promise.all([
      api<{ strategies: StrategyDefinition[] }>("/strategies"), api<{ datasets: DatasetSnapshot[] }>("/datasets"), api<{ hypotheses: HypothesisRecord[] }>("/hypotheses"),
    ]);
    setStrategies(strategyResponse.strategies); setDatasets(datasetResponse.datasets); setHypotheses(hypothesisResponse.hypotheses);
    setSelectedStrategy((current) => current || strategyResponse.strategies[0]?.versionId || "");
    setSelectedDataset((current) => current || datasetResponse.datasets[0]?.id || "");
  }, []);
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [load]);
  const generate = async () => {
    setBusy(true); setError("");
    try {
      const response = await api<{ strategy: StrategyDefinition }>("/strategies/generate", { method: "POST", body: JSON.stringify({ objective, hypothesisId: hypothesisId || null }) });
      await load(); setSelectedStrategy(response.strategy.versionId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to generate strategy"); }
    finally { setBusy(false); }
  };
  const generateDataset = async () => {
    setBusy(true); setError("");
    try {
      const response = await api<{ dataset: DatasetSnapshot }>("/datasets/synthetic", { method: "POST", body: JSON.stringify({ seed, rows: 756, symbol: "SYNTH", frequency: "1d" }) });
      await load(); setSelectedDataset(response.dataset.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create dataset snapshot"); }
    finally { setBusy(false); }
  };
  const run = async () => {
    if (!selectedStrategy || !selectedDataset) return;
    setBusy(true); setError("");
    try {
      const response = await api<{ backtest: BacktestRecord }>("/backtests", { method: "POST", body: JSON.stringify({ strategyVersionId: selectedStrategy, datasetSnapshotId: selectedDataset, initialCapital: 100000, costBps: 2, slippageBps: 1, validationSeed: 991, validationSamples: 200 }) });
      navigate(`/backtests?run=${response.backtest.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to execute backtest"); }
    finally { setBusy(false); }
  };
  return <div className="page strategy-factory-page">
    <PageHeader eyebrow="Phase 5 · reproducible research" title="Strategy Factory" description="Turn an objective into a versioned strategy, bind it to an immutable dataset snapshot, and run a cost-aware validation suite." actions={<button className="button secondary" onClick={() => load()}><RefreshCw size={15} />Refresh</button>} />
    {error && <div className="phase4-error">{error}</div>}
    <section className="factory-flow reveal delay-1"><article className="factory-step glass-panel"><header><span>1</span><div><p className="eyebrow"><Target size={12} />Research intent</p><h2>Describe the objective</h2></div></header><textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={5} /><label>Linked hypothesis<select value={hypothesisId} onChange={(event) => setHypothesisId(event.target.value)}><option value="">No hypothesis</option>{hypotheses.map((hypothesis) => <option key={hypothesis.id} value={hypothesis.id}>{hypothesis.title}</option>)}</select></label><button className="button primary full" onClick={generate} disabled={busy || objective.trim().length < 10}><Sparkles size={14} />Generate strategy</button></article>
      <article className="factory-step glass-panel"><header><span>2</span><div><p className="eyebrow"><Database size={12} />Data contract</p><h2>Freeze the dataset</h2></div></header><div className="seed-control"><label>Deterministic seed<input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} /></label><button className="button secondary" onClick={generateDataset} disabled={busy}><Plus size={14} />Create snapshot</button></div><div className="dataset-list">{datasets.map((dataset) => <button key={dataset.id} className={selectedDataset === dataset.id ? "selected" : ""} onClick={() => setSelectedDataset(dataset.id)}><Database size={15} /><span><strong>{dataset.name}</strong><small>{dataset.rows} bars · {dataset.symbol} · {dataset.checksum.slice(0, 10)}</small></span>{selectedDataset === dataset.id && <CheckCircle2 size={14} />}</button>)}{!datasets.length && <p>Create the first offline synthetic snapshot.</p>}</div></article>
      <article className="factory-step glass-panel"><header><span>3</span><div><p className="eyebrow"><Beaker size={12} />Execution</p><h2>Choose an immutable version</h2></div></header><div className="strategy-choice-list">{strategies.map((strategy) => <button key={strategy.versionId} className={selectedStrategy === strategy.versionId ? "selected" : ""} onClick={() => setSelectedStrategy(strategy.versionId)}><span className="strategy-template-icon"><Braces size={16} /></span><span><strong>{strategy.name} · v{strategy.version}</strong><small>{strategy.template.replace("_", " ")} · lag {String(strategy.config.signalLag)} bar</small></span></button>)}{!strategies.length && <p>Generate a strategy from the objective first.</p>}</div><div className="run-assumptions"><span><strong>2 bps</strong> costs</span><span><strong>1 bps</strong> slippage</span><span><strong>200</strong> validation samples</span></div><button className="button primary full" onClick={run} disabled={busy || !selectedStrategy || !selectedDataset}><Play size={14} />Run reproducible backtest</button></article></section>
    <section className="factory-catalog reveal delay-2"><header><div><p className="eyebrow"><FlaskConical size={12} />Version registry</p><h2>Generated strategies</h2></div><span><Link2 size={13} />Exact hypothesis and run lineage</span></header><div className="factory-strategy-grid">{strategies.map((strategy) => <article key={strategy.versionId}><div><span className={`template-pill ${strategy.template}`}>{strategy.template.replace("_", " ")}</span><small>v{strategy.version}</small></div><h3>{strategy.name}</h3><p>{strategy.thesis}</p><pre>{strategy.code}</pre><footer><span>{strategy.hypothesisId ? "Hypothesis linked" : "No hypothesis"}</span><strong>{Object.entries(strategy.config).map(([key, value]) => `${key}=${value}`).join(" · ")}</strong></footer></article>)}</div></section>
  </div>;
}
