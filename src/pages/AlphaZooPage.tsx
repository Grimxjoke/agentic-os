import { useEffect, useState } from "react";
import { Atom, CheckCircle2, Clock3, FlaskConical, Search } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { AlphaFactor } from "../types";

export function AlphaZooPage() {
  const [factors, setFactors] = useState<AlphaFactor[]>([]); const [query, setQuery] = useState("");
  useEffect(() => { api<{ factors: AlphaFactor[] }>("/alpha-zoo").then((response) => setFactors(response.factors)); }, []);
  const visible = factors.filter((factor) => `${factor.name} ${factor.family} ${factor.description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page alpha-zoo-page"><PageHeader eyebrow="Research factor catalog" title="Alpha Zoo" description="A truthful inventory of implemented, research-only, and planned factor families. Availability is explicit." /><div className="artifact-toolbar"><div className="toolbar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search factor families…" /></div></div><section className="alpha-grid">{visible.map((factor) => <article className="glass-panel" key={factor.id}><header><span className={`alpha-status ${factor.status}`}>{factor.status === "available" ? <CheckCircle2 size={13} /> : factor.status === "research" ? <FlaskConical size={13} /> : <Clock3 size={13} />}{factor.status}</span><Atom size={18} /></header><p>{factor.family}</p><h2>{factor.name}</h2><span>{factor.description}</span><footer>{factor.status === "available" ? "Executable by the deterministic engine" : factor.status === "research" ? "Catalogued but not executable" : "No implementation claimed"}</footer></article>)}</section></div>;
}
