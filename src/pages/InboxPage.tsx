import { useState } from "react";
import { Check, CheckCircle2, Clock3, FileText, Inbox, MessageCircleQuestion, ShieldAlert, Sparkles, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";

const seedItems = [
  { id: 1, agent: "Pi Core", color: "cyan", type: "Décision", title: "Valider la nouvelle hiérarchie", detail: "Atlas et Muse seront rattachés directement à Pi Core. Heron restera en veille.", time: "il y a 8 min", icon: MessageCircleQuestion },
  { id: 2, agent: "Atlas", color: "violet", type: "Fichier", title: "Choisir la mémoire canonique", detail: "Le fichier vision.md et Memory Inspector contiennent deux formulations différentes.", time: "il y a 34 min", icon: FileText },
  { id: 3, agent: "Heron", color: "amber", type: "Permission future", title: "Activer les données TradingView", detail: "Le widget public nécessite une connexion Internet pour charger les données de marché.", time: "hier · 18:42", icon: ShieldAlert },
];

export function InboxPage() {
  const [items, setItems] = useState(seedItems);
  const resolve = (id: number) => setItems((current) => current.filter((item) => item.id !== id));
  return <div className="page inbox-page">
    <PageHeader eyebrow="Human in the loop" title="Human Inbox" description="Les décisions qui nécessitent votre attention, regroupées sans interrompre le travail des agents." actions={<span className="inbox-count"><Inbox size={14} />{items.length} en attente</span>} />
    <div className="inbox-layout reveal delay-1">
      <section className="inbox-list glass-panel">
        <header><div><p className="section-kicker">À décider</p><h3>Demandes ouvertes</h3></div><button className="text-button">Tout marquer comme lu</button></header>
        {items.length ? items.map((item) => { const Icon = item.icon; return <article className="inbox-item" key={item.id}>
          <Avatar name={item.agent} color={item.color} />
          <div className="inbox-item-main"><div><span className="inbox-type"><Icon size={12} />{item.type}</span><small><Clock3 size={11} />{item.time}</small></div><h3>{item.title}</h3><p>{item.detail}</p><footer><span>{item.agent}</span><div><button className="button secondary compact" onClick={() => resolve(item.id)}><X size={13} />Ignorer</button><button className="button primary compact" onClick={() => resolve(item.id)}><Check size={13} />Valider</button></div></footer></div>
        </article>; }) : <div className="inbox-empty"><CheckCircle2 size={28} /><h3>Inbox à zéro</h3><p>Aucune décision n'attend votre attention.</p></div>}
      </section>
      <aside className="inbox-aside glass-panel"><Sparkles size={20} /><h3>Pourquoi cette page ?</h3><p>Les agents continuent leurs tâches non bloquées pendant que les décisions sont mises en file d'attente ici.</p><div><strong>Temps économisé</strong><span>≈ 42 min cette semaine</span></div></aside>
    </div>
  </div>;
}
