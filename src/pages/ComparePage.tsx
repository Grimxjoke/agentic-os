import { useEffect, useState } from "react";
import { GitCompareArrows, Scale, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { BacktestRecord } from "../types";

export function ComparePage() {
  const [runs, setRuns] = useState<BacktestRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<BacktestRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { api<{ backtests: BacktestRecord[] }>("/backtests").then((response) => setRuns(response.backtests.filter((run) => run.status === "completed"))).catch((reason) => setError(reason.message)); }, []);
  const compare = async () => {
    setError("");
    try { const response = await api<{ backtests: BacktestRecord[] }>("/backtests/compare", { method: "POST", body: JSON.stringify({ ids: selected }) }); setComparison(response.backtests); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Comparison failed"); setComparison([]); }
  };
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const columns = { gridTemplateColumns: `160px repeat(${comparison.length}, minmax(110px,1fr))` };
  return <div className="page compare-page"><PageHeader eyebrow="Comparable evidence only" title="Backtest Compare" description="Orbit compares candidates only when dataset checksum, capital, transaction costs, and slippage are identical." actions={<button className="button primary" onClick={compare} disabled={selected.length < 2}><GitCompareArrows size={15} />Compare {selected.length}</button>} />{error && <div className="phase4-error"><ShieldAlert size={14} />{error}</div>}
    <section className="compare-selector reveal delay-1">{runs.map((run) => <label key={run.id} className={selected.includes(run.id) ? "selected" : ""}><input type="checkbox" checked={selected.includes(run.id)} onChange={() => toggle(run.id)} /><span><strong>{run.strategySnapshot.name}</strong><small>{run.dataSnapshot.name} · {run.dataSnapshot.checksum.slice(0, 8)}</small></span><em>Sharpe {run.metrics?.sharpe.toFixed(2)}</em></label>)}</section>
    {comparison.length > 0 ? <section className="comparison-table glass-panel reveal delay-2"><div className="comparison-row head" style={columns}><span>Metric</span>{comparison.map((run) => <strong key={run.id}>{run.strategySnapshot.name}</strong>)}</div>{[
      ["Total return", "totalReturn", true], ["Annualized return", "annualizedReturn", true], ["Sharpe", "sharpe", false], ["Sortino", "sortino", false], ["Max drawdown", "maxDrawdown", true], ["Win rate", "winRate", true], ["Profit factor", "profitFactor", false], ["Trades", "tradeCount", false],
    ].map(([label, key, isPercent]) => <div className="comparison-row" style={columns} key={String(key)}><span>{label}</span>{comparison.map((run, index) => { const value = run.metrics?.[key as keyof NonNullable<BacktestRecord["metrics"]>] as number | null | undefined; return <strong className={index === 0 ? "winner" : ""} key={run.id}>{value == null ? "—" : isPercent ? `${(value * 100).toFixed(2)}%` : Number.isInteger(value) ? value : value.toFixed(2)}</strong>; })}</div>)}</section> : <div className="phase4-placeholder"><Scale size={30} /><h2>Select compatible runs</h2><p>Use the same dataset snapshot and cost assumptions to produce a defensible comparison.</p></div>}
  </div>;
}
