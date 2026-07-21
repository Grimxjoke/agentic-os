import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Beaker, CheckCircle2, CirclePause, CirclePlay, Cpu, FlaskConical, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { DatasetSnapshot, ExperimentRecord, StrategyDefinition } from "../types";

const activeStatuses = new Set(["queued", "running"]);

export function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [datasets, setDatasets] = useState<DatasetSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ExperimentRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [experimentResponse, strategyResponse, datasetResponse] = await Promise.all([
      api<{ experiments: ExperimentRecord[] }>("/experiments"), api<{ strategies: StrategyDefinition[] }>("/strategies"), api<{ datasets: DatasetSnapshot[] }>("/datasets"),
    ]);
    setExperiments(experimentResponse.experiments); setStrategies(strategyResponse.strategies); setDatasets(datasetResponse.datasets);
    setSelectedId((current) => current || experimentResponse.experiments[0]?.id || "");
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!selectedId) return;
    const response = await api<{ experiment: ExperimentRecord }>(`/experiments/${selectedId}`); setDetail(response.experiment);
  }, [selectedId]);

  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [load]);
  useEffect(() => { refreshDetail().catch((reason) => setError(reason.message)); }, [refreshDetail]);
  useEffect(() => {
    if (!detail || !activeStatuses.has(detail.status)) return;
    const timer = window.setInterval(() => { refreshDetail().then(load).catch((reason) => setError(reason.message)); }, 1_000);
    return () => window.clearInterval(timer);
  }, [detail?.status, load, refreshDetail]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await api<{ experiment: ExperimentRecord }>("/experiments", { method: "POST", body: JSON.stringify({
        name: values.get("name"), objective: values.get("objective"), baseStrategyVersionId: values.get("strategy"), datasetSnapshotId: values.get("dataset"),
        budget: { maxGenerations: Number(values.get("generations")), candidatesPerGeneration: Number(values.get("candidates")), maxBacktests: Number(values.get("backtests")), maxTokens: 0, maxCostUsd: 0, maxDurationSeconds: 3600, patienceGenerations: 2, minImprovement: 0.001 },
        score: { metric: values.get("metric"), minTrades: Number(values.get("minTrades")), maxDrawdown: Number(values.get("maxDrawdown")), drawdownPenalty: 0.25 },
      }) });
      setSelectedId(response.experiment.id); await load(); setDetail(response.experiment);
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };

  const action = async (name: "start" | "pause" | "resume" | "cancel") => {
    if (!detail) return; setBusy(true); setError("");
    try { await api(`/experiments/${detail.id}/${name}`, { method: "POST" }); await refreshDetail(); await load(); }
    catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };

  return <div className="page experiment-page"><PageHeader eyebrow="Durable research optimization" title="Experiment Studio" description="Run bounded generations of deterministic strategy candidates. Champions remain research-only and never promote themselves to paper or live trading." actions={<button className="button secondary" onClick={() => { load(); refreshDetail(); }}><RefreshCw size={15} />Refresh</button>} />
    {error && <div className="phase4-error">{error}</div>}
    <section className="experiment-create glass-panel reveal"><form onSubmit={create}><label>Name<input name="name" defaultValue="Bounded strategy search" required /></label><label className="wide">Objective<input name="objective" defaultValue="Find a robust challenger after costs without promoting it to trading" required /></label><label>Base strategy<select name="strategy" required>{strategies.map((item) => <option key={item.versionId} value={item.versionId}>{item.name} · v{item.version}</option>)}</select></label><label>Dataset<select name="dataset" required>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.rows} rows</option>)}</select></label><label>Generations<input name="generations" type="number" min="1" max="20" defaultValue="2" /></label><label>Candidates / generation<input name="candidates" type="number" min="1" max="12" defaultValue="3" /></label><label>Maximum backtests<input name="backtests" type="number" min="1" max="120" defaultValue="6" /></label><label>Score<select name="metric"><option value="sharpe">Sharpe</option><option value="sortino">Sortino</option><option value="totalReturn">Total return</option></select></label><label>Minimum trades<input name="minTrades" type="number" min="0" defaultValue="5" /></label><label>Maximum drawdown<input name="maxDrawdown" type="number" min="0" max="1" step="0.05" defaultValue="0.35" /></label><button className="button primary" disabled={busy || !strategies.length || !datasets.length}><Sparkles size={15} />Create experiment</button></form></section>
    <div className="experiment-layout"><aside className="experiment-list glass-panel">{experiments.map((item) => <button key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}><i className={`run-status-dot ${item.status}`} /><span><strong>{item.name}</strong><small>{item.generationsCompleted}/{item.budget.maxGenerations} generations · {item.backtestsUsed}/{item.budget.maxBacktests} backtests</small></span><em>{item.status}</em></button>)}{!experiments.length && <p>Create the first bounded experiment above.</p>}</aside>{detail && <ExperimentDetail experiment={detail} busy={busy} action={action} />}</div>
  </div>;
}

function ExperimentDetail({ experiment, busy, action }: { experiment: ExperimentRecord; busy: boolean; action: (name: "start" | "pause" | "resume" | "cancel") => void }) {
  const champion = experiment.candidates?.find((candidate) => candidate.id === experiment.championCandidateId);
  const generations = useMemo(() => experiment.generations?.map((generation) => ({ ...generation, candidates: experiment.candidates?.filter((candidate) => candidate.generationId === generation.id) || [] })) || [], [experiment]);
  return <section className="experiment-detail"><article className="experiment-hero glass-panel"><header><div><p className="eyebrow"><span />{experiment.status}</p><h2>{experiment.name}</h2><p>{experiment.objective}</p></div><div className="experiment-actions">{["draft", "paused"].includes(experiment.status) && <button className="button primary" disabled={busy} onClick={() => action(experiment.status === "paused" ? "resume" : "start")}><CirclePlay size={15} />{experiment.status === "paused" ? "Resume" : "Start"}</button>}{activeStatuses.has(experiment.status) && <button className="button secondary" disabled={busy} onClick={() => action("pause")}><CirclePause size={15} />Pause</button>}{!["completed", "failed", "cancelled"].includes(experiment.status) && <button className="button secondary danger" disabled={busy} onClick={() => action("cancel")}><Ban size={15} />Cancel</button>}</div></header><div className="experiment-kpis"><Metric icon={Beaker} label="Generations" value={`${experiment.generationsCompleted}/${experiment.budget.maxGenerations}`} /><Metric icon={FlaskConical} label="Evaluated" value={String(experiment.candidatesEvaluated)} /><Metric icon={Cpu} label="CPU backtests" value={`${experiment.backtestsUsed}/${experiment.budget.maxBacktests}`} /><Metric icon={Trophy} label="Champion score" value={champion?.score?.toFixed(4) || "—"} /></div><p className="research-boundary"><CheckCircle2 size={14} />Research champion only · paper promotion: disabled · live promotion: disabled</p></article>
    <div className="generation-grid">{generations.map((generation) => <article className="generation-card glass-panel" key={generation.id}><header><span>GEN {generation.number}</span><strong>{generation.status}</strong></header><div>{generation.candidates.map((candidate) => <div className={`candidate-row ${candidate.id === experiment.championCandidateId ? "champion" : ""}`} key={candidate.id}><span>{candidate.id === experiment.championCandidateId ? <Trophy size={13} /> : <FlaskConical size={13} />}<i><strong>{candidate.name}</strong><small>{Object.entries(candidate.parameters).filter(([, value]) => typeof value === "number").map(([key, value]) => `${key}=${value}`).join(" · ")}</small></i></span><em>{candidate.score === null ? candidate.status : candidate.score.toFixed(4)}</em></div>)}</div><footer>{generation.lessons[0] || "Generation awaiting evaluation."}</footer></article>)}</div>
    <article className="experiment-events glass-panel"><h3>Durable transition log</h3>{experiment.events?.slice(0, 20).map((event) => <div key={event.id} className={event.level}><span>{event.type}</span><p>{event.message}</p><time>{new Date(event.createdAt).toLocaleString()}</time></div>)}</article>
  </section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Beaker; label: string; value: string }) { return <div><Icon size={17} /><span><small>{label}</small><strong>{value}</strong></span></div>; }
