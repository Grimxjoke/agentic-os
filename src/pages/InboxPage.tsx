import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Clock3, Inbox, ShieldAlert, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";

type Request = { id: string; status: "pending" | "approved" | "rejected" | "expired"; risk: "A" | "B" | "C" | "D"; title: string; detail: string; expiresAt: string | null; createdAt: string };
export function InboxPage() {
  const [items, setItems] = useState<Request[]>([]); const [error, setError] = useState("");
  const load = useCallback(async () => { const result = await api<{ requests: Request[] }>("/inbox"); setItems(result.requests); }, []);
  useEffect(() => { load().catch((reason) => setError(reason.message)); const timer = window.setInterval(() => load().catch(() => undefined), 15_000); return () => window.clearInterval(timer); }, [load]);
  const resolve = async (id: string, status: "approved" | "rejected") => { try { await api(`/inbox/${id}/resolve`, { method: "POST", body: JSON.stringify({ status }) }); await load(); } catch (reason) { setError((reason as Error).message); } };
  const pending = items.filter((item) => item.status === "pending");
  return <div className="page inbox-page"><PageHeader eyebrow="Phase 7 · human control" title="Human Inbox" description="Durable decisions with approvals, rejections, expiration, and an audit trail. Independent workflow branches continue while one decision waits." actions={<span className="inbox-count"><Inbox size={14} />{pending.length} pending</span>} />{error && <div className="phase4-error">{error}</div>}<div className="inbox-layout reveal delay-1"><section className="inbox-list glass-panel"><header><div><p className="section-kicker">To decide</p><h3>Open requests</h3></div></header>{pending.length ? pending.map((item) => <article className="inbox-item" key={item.id}><ShieldAlert size={22} /><div className="inbox-item-main"><div><span className="inbox-type">Risk {item.risk}</span><small><Clock3 size={11} />{item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : "No expiry"}</small></div><h3>{item.title}</h3><p>{item.detail}</p><footer><span>Created {new Date(item.createdAt).toLocaleString()}</span><div><button className="button secondary compact" onClick={() => resolve(item.id, "rejected")}><X size={13} />Reject</button><button className="button primary compact" onClick={() => resolve(item.id, "approved")}><Check size={13} />Approve</button></div></footer></div></article>) : <div className="inbox-empty"><CheckCircle2 size={28} /><h3>Inbox to zero</h3><p>There are no decisions awaiting your attention.</p></div>}</section></div></div>;
}
