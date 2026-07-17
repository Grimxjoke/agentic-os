import { useCallback, useEffect, useState } from "react";
import {
  Activity, Bot, CheckCircle2, Clock3, Command, Database, Download, Gauge,
  HardDrive, RefreshCw, Server, ShieldCheck, Sparkles, TriangleAlert, Zap,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { SystemOverview, SystemService } from "../types";

const serviceIcons = { orbit: Server, database: Database, pi: Bot, codex: Command, vibe: Zap };

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days ? `${days}j ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

export function ControlCenterPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const next = await api<SystemOverview>("/system/overview");
      setOverview(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "System unavailable");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const createBackup = async () => {
    setBackingUp(true);
    setNotice("");
    try {
      const result = await api<{ ok: true; backup: { filename: string; bytes: number } }>("/system/backups", { method: "POST" });
      setNotice(`${result.backup.filename} · ${formatBytes(result.backup.bytes)}`);
      await refresh(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save");
    } finally {
      setBackingUp(false);
    }
  };

  const available = overview?.services.filter((service) => service.status === "operational" || service.status === "available").length ?? 0;

  return <div className="page control-page system-page">
    <PageHeader
      eyebrow="Phase 1 · Persistent control-plane"
      title="System"
      description="Health, persistence and activity measured directly by Orbit. No status on this page comes from demo data."
      actions={<><button className="button secondary" onClick={() => refresh()} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} />Refresh</button><button className="button primary" onClick={createBackup} disabled={backingUp || !overview}><Download size={14} />{backingUp ? "Backing up…" : "Back up SQLite"}</button></>}
    />

    {error && <div className="system-alert error"><TriangleAlert size={17} /><span><strong>Partially unavailable status</strong><small>{error}</small></span><button className="button secondary compact" onClick={() => refresh()}>Try again</button></div>}
    {notice && <div className="system-alert success"><CheckCircle2 size={17} /><span><strong>Backup created</strong><small>{notice}</small></span></div>}

    <section className="control-statusbar system-statusbar reveal delay-1">
      <div><span className="control-status-icon"><Gauge size={18} /></span><p><strong>{overview ? `${available}/${overview.services.length}` : "—"}</strong><small>Composants disponibles</small></p></div>
      <div><span className="control-status-icon violet"><Clock3 size={18} /></span><p><strong>{overview ? formatDuration(overview.runtime.uptimeSeconds) : "—"}</strong><small>Uptime Orbit</small></p></div>
      <div><span className="control-status-icon rose"><Database size={18} /></span><p><strong>{overview?.database.schemaVersion ?? "—"}</strong><small>Schema version</small></p></div>
      <div><span className="control-status-icon amber"><ShieldCheck size={18} /></span><p><strong>{overview?.counts.activeSessions ?? "—"}</strong><small>Sessions actives</small></p></div>
      <span className={`control-heartbeat ${error ? "degraded" : ""}`}><span className="pulse-dot" />{loading ? "Synchronisation" : error ? "Gradient" : "Mesure active"}</span>
    </section>

    <div className="system-grid reveal delay-2">
      <section className="system-services glass-panel">
        <header className="panel-heading"><div><p className="section-kicker">Runtime topology</p><h3>Observed components</h3></div><span className="system-freshness"><Activity size={13} />{overview ? `Measured at${timeLabel(overview.generatedAt)}` : "En attente"}</span></header>
        <div className="system-service-list">
          {loading && !overview && Array.from({ length: 5 }, (_, index) => <div className="system-service skeleton" key={index} />)}
          {overview?.services.map((service) => <ServiceRow service={service} key={service.id} />)}
        </div>
      </section>

      <aside className="system-storage glass-panel">
        <div className="panel-heading"><div><p className="section-kicker">Canonical storage</p><h3>SQLite control-plane</h3></div><span className="database-orb"><Database size={20} /></span></div>
        <div className="storage-orbit" aria-hidden="true"><i /><i /><span><Database size={22} /></span></div>
        <dl className="system-definition-list">
          <div><dt>Moteur</dt><dd>{overview?.database.engine ?? "—"}</dd></div>
          <div><dt>Taille</dt><dd>{overview ? formatBytes(overview.database.bytes) : "—"}</dd></div>
          <div><dt>Processus</dt><dd>{overview ? formatBytes(overview.runtime.memoryBytes) : "—"} RAM</dd></div>
          <div><dt>Runtime</dt><dd>{overview?.runtime.node ?? "—"}</dd></div>
        </dl>
        <div className="persistence-note"><ShieldCheck size={15} /><span><strong>Sustainable writing</strong><small>WAL, synchronous FULL and atomic transactions.</small></span></div>
      </aside>
    </div>

    <section className="system-metrics reveal delay-2">
      <Metric icon={Command} label="Conversations" value={overview?.counts.conversations} detail={`${overview?.counts.messages ?? 0} messages`} />
      <Metric icon={Activity} label="Jobs" value={overview?.counts.jobs} detail={`${overview?.counts.runningJobs ?? 0} en cours`} tone="violet" />
      <Metric icon={Sparkles} label="Events" value={overview?.counts.events} detail="Operational ledger" tone="rose" />
      <Metric icon={ShieldCheck} label="Audit" value={overview?.counts.auditEntries} detail={`${overview?.counts.pendingDecisions ?? 0}pending decision`} tone="amber" />
    </section>

    <section className="system-activity glass-panel reveal delay-3">
      <header className="panel-heading"><div><p className="section-kicker">Persistent event stream</p><h3>Recent activity</h3></div><span>{overview?.activity.length ?? 0} events displayed</span></header>
      <div className="system-event-list">
        {!loading && !overview?.activity.length && <div className="system-empty"><Activity size={18} /><span><strong>No events</strong><small>Upcoming PI/Codex jobs will appear here.</small></span></div>}
        {overview?.activity.map((event) => <article key={event.id} className={event.level}><span className="event-signal" /><div><strong>{event.message}</strong><small>{event.type}{event.jobId ? ` · job ${event.jobId.slice(0, 8)}` : ""}</small></div><time>{timeLabel(event.createdAt)}</time></article>)}
      </div>
    </section>
  </div>;
}

function ServiceRow({ service }: { service: SystemService }) {
  const Icon = serviceIcons[service.id as keyof typeof serviceIcons] ?? Server;
  const label = service.status === "operational" ? "operational" : service.status === "available" ? "disponible" : service.status === "deferred" ? "deferred" : "unavailable";
  return <article className={`system-service ${service.status}`}><span className="service-orb"><Icon size={17} /></span><div><strong>{service.name}</strong><small>{service.detail}</small></div><span className={`runtime-state ${service.status}`}><i />{label}</span></article>;
}

function Metric({ icon: Icon, label, value, detail, tone = "cyan" }: { icon: typeof Activity; label: string; value?: number; detail: string; tone?: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}><Icon size={17} /></span><div><p>{label}</p><strong>{value ?? "—"}</strong><span>{detail}</span></div></article>;
}
