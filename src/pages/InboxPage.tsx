import { useState } from "react";
import { Check, CheckCircle2, Clock3, FileText, Inbox, MessageCircleQuestion, ShieldAlert, Sparkles, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";

const seedItems = [
  { id: 1, agent: "Pi Core", color: "cyan", type: "Decision", title: "Validate the new hierarchy", detail: "Atlas and Muse will be attached directly to Pi Core. Heron will remain on standby.", time: "8 min ago", icon: MessageCircleQuestion },
  { id: 2, agent: "Atlas", color: "violet", type: "File", title: "Choose canonical memory", detail: "The vision.md file and Memory Inspector contain two different wordings.", time: "34 min ago", icon: FileText },
  { id: 3, agent: "Heron", color: "amber", type: "Permission future", title: "Enable TradingView data", detail: "The public widget requires an internet connection to load market data.", time: "hier · 18:42", icon: ShieldAlert },
];

export function InboxPage() {
  const [items, setItems] = useState(seedItems);
  const resolve = (id: number) => setItems((current) => current.filter((item) => item.id !== id));
  return <div className="page inbox-page">
    <PageHeader eyebrow="Human in the loop" title="Human Inbox" description="Decisions that need your attention, grouped together without interrupting the work of agents." actions={<span className="inbox-count"><Inbox size={14} />{items.length} pending</span>} />
    <div className="inbox-layout reveal delay-1">
      <section className="inbox-list glass-panel">
        <header><div><p className="section-kicker">To decide</p><h3>Demandes ouvertes</h3></div><button className="text-button">Mark all as read</button></header>
        {items.length ? items.map((item) => { const Icon = item.icon; return <article className="inbox-item" key={item.id}>
          <Avatar name={item.agent} color={item.color} />
          <div className="inbox-item-main"><div><span className="inbox-type"><Icon size={12} />{item.type}</span><small><Clock3 size={11} />{item.time}</small></div><h3>{item.title}</h3><p>{item.detail}</p><footer><span>{item.agent}</span><div><button className="button secondary compact" onClick={() => resolve(item.id)}><X size={13} />Ignore</button><button className="button primary compact" onClick={() => resolve(item.id)}><Check size={13} />Approve</button></div></footer></div>
        </article>; }) : <div className="inbox-empty"><CheckCircle2 size={28} /><h3>Inbox to zero</h3><p>There are no decisions awaiting your attention.</p></div>}
      </section>
      <aside className="inbox-aside glass-panel"><Sparkles size={20} /><h3>Why this page?</h3><p>Agents continue their unblocked tasks while decisions are queued here.</p><div><strong>Time saved</strong><span>≈ 42 min this week</span></div></aside>
    </div>
  </div>;
}
