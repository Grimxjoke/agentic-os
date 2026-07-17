import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Database, FileCheck2, FlaskConical, Gauge, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { BacktestRecord } from "../types";

const percent = (value: number | undefined) => value === undefined ? "—" : `${(value * 100).toFixed(2)}%`;
const number = (value: number | undefined) => value === undefined ? "—" : value.toFixed(2);

export function BacktestsPage() {
  const [params, setParams] = useSearchParams();
  const [runs, setRuns] = useState<BacktestRecord[]>([]);
  const [detail, setDetail] = useState<BacktestRecord | null>(null);
  const [error, setError] = useState("");
  const selectedId = params.get("run") || runs[0]?.id || "";
  const load = useCallback(async () => {
    const response = await api<{ backtests: BacktestRecord[] }>("/backtests"); setRuns(response.backtests);
  }, []);
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [load]);
  useEffect(() => { if (selectedId) api<{ backtest: BacktestRecord }>(`/backtests/${selectedId}`).then((response) => setDetail(response.backtest)).catch((reason) => setError(reason.message)); }, [selectedId]);
  return <div className="page backtests-page"><PageHeader eyebrow="Reproducible execution ledger" title="Backtest Runs" description="Inspect exact strategy, data, costs, equity, trades, warnings, and statistical validation artifacts." actions={<button className="button secondary" onClick={load}><RefreshCw size={15} />Refresh</button>} />{error && <div className="phase4-error">{error}</div>}
    <div className="backtest-layout reveal delay-1"><aside className="backtest-list glass-panel">{runs.map((run) => <button key={run.id} className={selectedId === run.id ? "selected" : ""} onClick={() => setParams({ run: run.id })}><span className={`run-status-dot ${run.status}`} /><span><strong>{run.strategySnapshot.name}</strong><small>{run.dataSnapshot.symbol} · {run.createdAt.slice(0, 10)}</small></span><em>{run.metrics ? number(run.metrics.sharpe) : run.status}</em></button>)}{!runs.length && <p>No backtest yet. Start in Strategy Factory.</p>}</aside>{detail ? <BacktestDetail run={detail} /> : <div className="phase4-placeholder"><FlaskConical size={30} /><h2>Select a backtest</h2></div>}</div>
  </div>;
}

function BacktestDetail({ run }: { run: BacktestRecord }) {
  const m = run.metrics || undefined;
  return <section className="backtest-detail"><div className="backtest-summary glass-panel"><header><div><p className="eyebrow"><span />{run.status}</p><h2>{run.strategySnapshot.name} · v{run.strategySnapshot.version}</h2><p>{run.strategySnapshot.objective}</p></div><span className={`artifact-health ${run.artifact?.status}`}><FileCheck2 size={15} />Report {run.artifact?.status || "unavailable"}</span></header><div className="backtest-metrics"><Metric icon={TrendingUp} label="Total return" value={percent(m?.totalReturn)} /><Metric icon={Gauge} label="Sharpe" value={number(m?.sharpe)} /><Metric icon={TrendingDown} label="Max drawdown" value={percent(m?.maxDrawdown)} /><Metric icon={BarChart3} label="Win rate" value={percent(m?.winRate)} /><Metric icon={FlaskConical} label="Trades" value={String(m?.tradeCount ?? "—")} /><Metric icon={Database} label="Exposure" value={percent(m?.exposure)} /></div><EquityChart values={run.equity || []} /></div>
    <div className="backtest-evidence-grid"><article className="glass-panel evidence-card"><h3><Database size={15} />Reproducibility snapshot</h3><dl><dt>Dataset</dt><dd>{run.dataSnapshot.name}</dd><dt>Checksum</dt><dd><code>{run.dataSnapshot.checksum}</code></dd><dt>Period</dt><dd>{run.dataSnapshot.startAt.slice(0, 10)} → {run.dataSnapshot.endAt.slice(0, 10)}</dd><dt>Rows</dt><dd>{run.dataSnapshot.rows}</dd><dt>Costs</dt><dd>{run.config.costBps} bps + {run.config.slippageBps} bps slippage</dd><dt>Signal lag</dt><dd>{String(run.strategySnapshot.config.signalLag)} completed bar(s)</dd></dl></article><article className="glass-panel evidence-card"><h3><FileCheck2 size={15} />Validation suite</h3><div className="validation-list">{run.validations?.map((validation) => <div key={validation.id} className={validation.status}>{validation.status === "passed" ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}<span><strong>{validation.kind.replace("_", " ")}</strong><small>{validation.summary}</small></span><code>{summarizeMetrics(validation.metrics)}</code></div>)}</div></article></div>
    {(run.warnings.length > 0 || run.artifact?.status !== "available") && <article className="backtest-warnings glass-panel"><h3><AlertTriangle size={15} />Research warnings</h3>{run.warnings.map((warning) => <p key={warning}>{warning}</p>)}{run.artifact?.detail && <p>{run.artifact.detail}</p>}</article>}
    <article className="glass-panel trades-card"><header><h3>Trade log</h3><span>{run.trades?.length || 0} closed trades</span></header><div className="trades-table"><div className="trade-row head"><span>Side</span><span>Entry bar</span><span>Exit bar</span><span>Entry</span><span>Exit</span><span>Net return</span></div>{run.trades?.slice(0, 100).map((trade, index) => <div className="trade-row" key={`${trade.entryIndex}-${index}`}><span>{trade.side}</span><span>{trade.entryIndex}</span><span>{trade.exitIndex}</span><span>{trade.entryPrice.toFixed(3)}</span><span>{trade.exitPrice.toFixed(3)}</span><span className={trade.pnl >= 0 ? "positive" : "negative"}>{percent(trade.pnl)}</span></div>)}</div></article>
  </section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) { return <div><Icon size={16} /><span><small>{label}</small><strong>{value}</strong></span></div>; }

function EquityChart({ values }: { values: number[] }) {
  const points = useMemo(() => {
    if (values.length < 2) return "";
    const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || 1;
    return values.map((value, index) => `${(index / (values.length - 1)) * 100},${90 - ((value - min) / spread) * 75}`).join(" ");
  }, [values]);
  return <div className="equity-chart"><div><span>Equity curve</span><small>{values.length} deterministic observations</small></div>{points ? <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} /></svg> : <p>No equity series available.</p>}</div>;
}

function summarizeMetrics(metrics: Record<string, unknown>) {
  return Object.entries(metrics).slice(0, 2).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : String(value)}`).join(" · ");
}
