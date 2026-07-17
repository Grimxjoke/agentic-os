import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, Bot, CircleAlert, CircleDollarSign, Command, Gauge, Network, Play, RefreshCw, Sparkles, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { Observatory } from "../types";

function statusLabel(status: string) {
  return ({ queued: "En file", running: "En cours", degraded: "Dégradé", completed: "Terminé", failed: "Échec", cancelled: "Annulé" } as Record<string, string>)[status] || status;
}

export function ObservatoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Observatory | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api<{ observatory: Observatory }>("/observatory")
    .then((result) => { setData(result.observatory); setError(""); })
    .catch((cause) => setError(cause instanceof Error ? cause.message : "Observatory indisponible")), []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5_000); return () => window.clearInterval(timer); }, [load]);

  const activeRuns = (data?.statuses.running || 0) + (data?.statuses.queued || 0) + (data?.statuses.degraded || 0);
  return <div className="page observatory-page observatory-real-page">
    <PageHeader eyebrow={data ? `Télémétrie réelle · ${new Date(data.generatedAt).toLocaleString("fr-FR")}` : "Synchronisation du control-plane"} title="Observatory" description="Une vue calculée depuis les agents, équipes, runs et événements persistés — sans données métier simulées." actions={<><button className="button secondary" onClick={() => void load()}><RefreshCw size={14} />Actualiser</button><button className="button primary" onClick={() => navigate("/runs")}><Play size={14} />Nouveau run</button></>} />
    {error && <div className="agent-alert"><CircleAlert size={14} />{error}</div>}

    <section className="orbital-launchpad reveal">
      <button onClick={() => navigate("/chat/pi")}><span className="tone-cyan"><Bot size={16} /></span><span><strong>Pi Chat</strong><small>Orchestration générale</small></span><em>OUVRIR</em></button>
      <button onClick={() => navigate("/chat/codex")}><span className="tone-violet"><Command size={16} /></span><span><strong>Codex Chat</strong><small>Build et vérification</small></span><em>OUVRIR</em></button>
      <button onClick={() => navigate("/vibe")}><span className="tone-amber"><Zap size={16} /></span><span><strong>Vibe Engine</strong><small>Exécuteur privé</small></span><em>PRIVÉ</em></button>
      <button onClick={() => navigate("/runs")}><span className="tone-rose"><Network size={16} /></span><span><strong>Teams & Runs</strong><small>{data?.teams ?? "—"} équipes versionnées</small></span><em>{activeRuns} ACTIF(S)</em></button>
      <button onClick={() => navigate("/control")}><span className="tone-cyan"><Gauge size={16} /></span><span><strong>Control Center</strong><small>Santé et backups</small></span><em>MESURÉ</em></button>
    </section>

    <section className="metric-grid reveal delay-1">
      <article className="metric-card"><div className="metric-icon cyan"><Bot size={18} /></div><div><p>Agents persistants</p><strong>{data?.agents ?? "—"}</strong><span>Définitions versionnées</span></div></article>
      <article className="metric-card"><div className="metric-icon violet"><Users size={18} /></div><div><p>Équipes DAG</p><strong>{data?.teams ?? "—"}</strong><span>Concurrence bornée à 2</span></div></article>
      <article className="metric-card"><div className="metric-icon rose"><Activity size={18} /></div><div><p>Runs actifs</p><strong>{data ? activeRuns : "—"}</strong><span>{data?.statuses.completed || 0} terminés</span></div></article>
      <article className="metric-card"><div className="metric-icon amber"><Sparkles size={18} /></div><div><p>Taux de succès</p><strong>{data?.successRate == null ? "—" : `${data.successRate}%`}</strong><span>Runs terminaux uniquement</span></div></article>
    </section>

    <section className="observatory-real-grid reveal delay-2">
      <article className="glass-panel observatory-workers"><div className="panel-heading"><div><p className="section-kicker">Live workers</p><h3>Agents au travail</h3></div><button className="text-button" onClick={() => navigate("/runs")}>Voir les runs <ArrowUpRight size={13} /></button></div><div className="agent-run-list">{data?.activeWorkers.map((worker) => <button className="agent-run" key={worker.id} onClick={() => navigate("/runs")}><Avatar name={worker.agentName} color={worker.color} /><div className="agent-run-main"><div><strong>{worker.agentName}</strong><span>{worker.nodeKey} · {worker.objective}</span></div></div><div className="agent-run-value"><strong>LIVE</strong><span>{worker.startedAt ? new Date(worker.startedAt).toLocaleTimeString("fr-FR") : "—"}</span></div></button>)}{data && !data.activeWorkers.length && <Empty label="Aucun worker en cours." />}{!data && <Empty label="Synchronisation…" />}</div></article>

      <article className="glass-panel observatory-usage"><div className="panel-heading"><div><p className="section-kicker">Measured usage</p><h3>Consommation des runs</h3></div><CircleDollarSign size={16} /></div><div className="observatory-usage-values"><div><span>Tokens remontés</span><strong>{data?.usage.tokens == null ? "—" : data.usage.tokens.toLocaleString("fr-FR")}</strong></div><div><span>Coût remonté</span><strong>{data?.usage.costUsd == null ? "—" : `$${data.usage.costUsd.toFixed(4)}`}</strong></div></div><p>Une valeur « — » signifie que le provider n’a pas fourni la métrique ; elle n’est jamais remplacée par zéro.</p></article>

      <article className="glass-panel observatory-runs"><div className="panel-heading"><div><p className="section-kicker">Durable history</p><h3>Runs récents</h3></div></div><div>{data?.recentRuns.map((run) => <button key={run.id} onClick={() => navigate("/runs")}><i className={`run-status ${run.status}`} /><span><strong>{run.snapshot.team.name}</strong><small>{run.objective}</small></span><em>{statusLabel(run.status)}</em></button>)}{data && !data.recentRuns.length && <Empty label="Aucun run enregistré." />}</div></article>

      <article className="glass-panel observatory-events"><div className="panel-heading"><div><p className="section-kicker">Control-plane</p><h3>Activité persistée</h3></div><button className="text-button" onClick={() => navigate("/activity")}>Ledger <ArrowUpRight size={13} /></button></div><div>{data?.activity.map((event) => <article key={event.id}><i className={event.level} /><span><strong>{event.message}</strong><small>{event.type} · {new Date(event.createdAt).toLocaleString("fr-FR")}</small></span></article>)}{data && !data.activity.length && <Empty label="Aucun événement." />}</div></article>
    </section>
  </div>;
}

function Empty({ label }: { label: string }) { return <div className="observatory-empty"><Activity size={17} /><span>{label}</span></div>; }
