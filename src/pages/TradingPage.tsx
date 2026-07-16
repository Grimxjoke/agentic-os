import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Bot, BriefcaseBusiness,
  CalendarDays, CandlestickChart, CheckCircle2, ChevronRight, CircleDollarSign,
  Eye, Filter, Gauge, ListFilter, Newspaper, NotebookPen, Plus, Search,
  ShieldCheck, Sparkles, Target, TrendingUp, WalletCards, Zap,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";

type MarketTab = "portfolio" | "screener" | "alerts" | "journal";
type WatchItem = { symbol: string; label: string; name: string; price: string; change: string; up: boolean; volume: string };

const watchlist: WatchItem[] = [
  { symbol: "NASDAQ:AAPL", label: "AAPL", name: "Apple", price: "212.44", change: "+1.28%", up: true, volume: "48.2M" },
  { symbol: "NASDAQ:NVDA", label: "NVDA", name: "NVIDIA", price: "173.26", change: "+2.41%", up: true, volume: "183M" },
  { symbol: "BITSTAMP:BTCUSD", label: "BTC/USD", name: "Bitcoin", price: "118,420", change: "+2.14%", up: true, volume: "42.8B" },
  { symbol: "FX:EURUSD", label: "EUR/USD", name: "Euro / Dollar", price: "1.0924", change: "-0.12%", up: false, volume: "92.4B" },
  { symbol: "OANDA:XAUUSD", label: "GOLD", name: "Gold Spot", price: "3,352.8", change: "+0.41%", up: true, volume: "18.2B" },
  { symbol: "NASDAQ:TSLA", label: "TSLA", name: "Tesla", price: "318.73", change: "-1.06%", up: false, volume: "71.8M" },
];

const positions = [
  { symbol: "NVDA", side: "Long", quantity: "40", entry: "$166.82", current: "$173.26", pnl: "+$257.60", change: "+3.86%", up: true },
  { symbol: "BTC", side: "Long", quantity: "0.18", entry: "$112,450", current: "$118,420", pnl: "+$1,074.60", change: "+5.31%", up: true },
  { symbol: "EUR/USD", side: "Short", quantity: "15K", entry: "1.0951", current: "1.0924", pnl: "+$40.50", change: "+0.25%", up: true },
  { symbol: "TSLA", side: "Long", quantity: "12", entry: "$325.10", current: "$318.73", pnl: "-$76.44", change: "-1.96%", up: false },
];

const screener = [
  { symbol: "NVDA", score: 92, regime: "Momentum", volatility: "Élevée", volume: "2.4×", signal: "Breakout" },
  { symbol: "BTC/USD", score: 88, regime: "Expansion", volatility: "Modérée", volume: "1.8×", signal: "Trend follow" },
  { symbol: "GOLD", score: 81, regime: "Défensif", volatility: "Faible", volume: "1.3×", signal: "Accumulation" },
  { symbol: "AAPL", score: 74, regime: "Range", volatility: "Faible", volume: "0.9×", signal: "Watch" },
  { symbol: "EUR/USD", score: 62, regime: "Compression", volatility: "Modérée", volume: "1.1×", signal: "Neutral" },
];

const news = [
  { time: "14:30", impact: "high", title: "CPI américain", detail: "Consensus 2,7% · marché sensible" },
  { time: "16:00", impact: "medium", title: "Stocks de pétrole EIA", detail: "Énergie et inflation implicite" },
  { time: "20:00", impact: "high", title: "Minutes FOMC", detail: "Volatilité USD attendue" },
];

export function TradingPage() {
  const [symbol, setSymbol] = useState("NASDAQ:AAPL");
  const [tab, setTab] = useState<MarketTab>("portfolio");
  const [interval, setInterval] = useState("D");
  const [paperMode, setPaperMode] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const active = watchlist.find((item) => item.symbol === symbol) ?? watchlist[0];

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return <div className="page trading-page v04-page">
    <PageHeader eyebrow="Market intelligence · paper environment" title="Market Command Center" description="Analyse multi-marchés, portefeuille simulé et décisions assistées — aucun ordre réel n’est transmis." actions={<><button className={"paper-mode " + (paperMode ? "active" : "")} onClick={() => setPaperMode(!paperMode)}><span><i /></span>{paperMode ? "Paper trading ON" : "Paper trading OFF"}</button><button className="button primary"><Plus size={15} />Nouvelle hypothèse</button></>} />

    <section className="market-kpis reveal delay-1">
      <article><span className="market-kpi-icon cyan"><WalletCards size={17} /></span><p><small>Valeur du portefeuille</small><strong>$124,830.40</strong><em className="positive"><ArrowUpRight size={12} />+$1,296 aujourd’hui</em></p><Sparkline tone="cyan" /></article>
      <article><span className="market-kpi-icon violet"><CircleDollarSign size={17} /></span><p><small>P&amp;L latent</small><strong>+$2,184.72</strong><em className="positive">+1.78%</em></p><Sparkline tone="violet" /></article>
      <article><span className="market-kpi-icon amber"><ShieldCheck size={17} /></span><p><small>Capital exposé</small><strong>38.4%</strong><em>Risque modéré</em></p><div className="exposure-ring"><span>38%</span></div></article>
      <article><span className="market-kpi-icon rose"><Target size={17} /></span><p><small>Buying power</small><strong>$76,920</strong><em>61.6% disponible</em></p><div className="buying-meter"><i /></div></article>
    </section>

    <section className="market-tape reveal delay-1" aria-label="Indices de marché simulés">
      {[["S&P 500","6,284.14","+0.54%",true],["NASDAQ 100","22,913.08","+0.81%",true],["DXY","98.46","-0.22%",false],["VIX","15.72","-3.18%",false],["ETH/USD","3,982","+1.92%",true]].map(([name, value, change, up]) => <span key={String(name)}><small>{name}</small><strong>{value}</strong><em className={up ? "positive" : "negative"}>{change}</em></span>)}
    </section>

    <section className="trading-desk market-command-grid reveal delay-2">
      <aside className="trading-watchlist glass-panel v04-surface">
        <header><div><p className="section-kicker">Marchés</p><h3>Watchlist</h3></div><div><button className="icon-button" aria-label="Filtrer"><ListFilter size={15} /></button><button className="icon-button" aria-label="Ajouter un actif"><Plus size={15} /></button></div></header>
        <label className="market-search"><Search size={13} /><input placeholder="Symbole ou marché…" /></label>
        {watchlist.map((item) => <button key={item.symbol} className={symbol === item.symbol ? "selected" : ""} onClick={() => setSymbol(item.symbol)}>
          <span><strong>{item.label}</strong><small>{item.name}</small></span>
          <span><strong>{item.price}</strong><em className={item.up ? "positive" : "negative"}>{item.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{item.change}</em></span>
          <ChevronRight size={14} />
        </button>)}
      </aside>

      <article className="tradingview-panel glass-panel v04-surface">
        <div className="tradingview-panel-head market-chart-head">
          <div><p className="section-kicker">{active.symbol}</p><h3>{active.label} <span>{active.price}</span></h3></div>
          <div className="chart-timeframes">{["1","5","15","H","D","W"].map((item) => <button className={interval === item ? "active" : ""} onClick={() => setInterval(item)} key={item}>{item}</button>)}</div>
          <span><i />Données TradingView</span>
        </div>
        <TradingViewWidget symbol={symbol} interval={interval} theme={theme} />
      </article>

      <aside className="trading-insights glass-panel v04-surface">
        <header><div className="research-agent-icon"><Bot size={21} /></div><span><p className="eyebrow"><i />Heron research</p><h3>Intelligence marché</h3></span><em><i />LIVE SIM</em></header>
        <div className="market-conviction"><div><span>Confiance du signal</span><strong>78%</strong></div><i><b /></i><p>Momentum positif, mais volatilité accrue avant le CPI.</p></div>
        <div className="compact-market-facts"><span><CandlestickChart size={14} /><strong>Tendance</strong><em>Haussière</em></span><span><ShieldCheck size={14} /><strong>Risque</strong><em>Modéré</em></span><span><TrendingUp size={14} /><strong>Régime</strong><em>Expansion</em></span><span><Activity size={14} /><strong>Volume</strong><em>{active.volume}</em></span></div>
        <div className="ai-thesis"><Sparkles size={14} /><p><strong>Thèse simulée</strong><span>Attendre un pullback vers le support avant toute nouvelle hypothèse.</span></p></div>
        <button className="button secondary full"><NotebookPen size={14} />Créer une note de recherche</button>
      </aside>
    </section>

    <section className="market-workbench glass-panel v04-surface reveal delay-3">
      <header>
        <div><p className="section-kicker">Operations layer</p><h3>Portefeuille &amp; analyse</h3></div>
        <div className="market-tabs">
          <button className={tab === "portfolio" ? "active" : ""} onClick={() => setTab("portfolio")}><BriefcaseBusiness size={13} />Portefeuille</button>
          <button className={tab === "screener" ? "active" : ""} onClick={() => setTab("screener")}><Filter size={13} />Screener</button>
          <button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}><Bell size={13} />Alertes & calendrier</button>
          <button className={tab === "journal" ? "active" : ""} onClick={() => setTab("journal")}><NotebookPen size={13} />Journal</button>
        </div>
      </header>

      {tab === "portfolio" && <div className="market-portfolio">
        <div className="market-table">
          <div className="market-table-row head"><span>Actif</span><span>Position</span><span>Quantité</span><span>Entrée</span><span>Prix actuel</span><span>P&amp;L</span><span>Variation</span><span /></div>
          {positions.map((position) => <div className="market-table-row" key={position.symbol}><span><i className="asset-mark">{position.symbol.slice(0,2)}</i><strong>{position.symbol}</strong></span><span><em className="side-pill">{position.side}</em></span><span>{position.quantity}</span><span>{position.entry}</span><span>{position.current}</span><span className={position.up ? "positive" : "negative"}><strong>{position.pnl}</strong></span><span className={position.up ? "positive" : "negative"}>{position.change}</span><button className="icon-button" aria-label={"Voir " + position.symbol}><Eye size={14} /></button></div>)}
        </div>
        <aside className="allocation-panel"><header><span><Gauge size={14} />Allocation</span><em>Simulée</em></header><div className="allocation-donut"><span><strong>38%</strong><small>exposé</small></span></div><div className="allocation-legend"><span><i className="violet" />Actions <strong>18%</strong></span><span><i className="cyan" />Crypto <strong>12%</strong></span><span><i className="amber" />Forex <strong>5%</strong></span><span><i className="rose" />Matières <strong>3%</strong></span><span><i />Cash <strong>62%</strong></span></div></aside>
      </div>}

      {tab === "screener" && <div className="screener-panel">
        <div className="screener-controls"><label><span>Univers</span><select><option>Tous les marchés</option><option>Actions US</option><option>Crypto</option><option>Forex</option></select></label><label><span>Régime</span><select><option>Tous les régimes</option><option>Momentum</option><option>Expansion</option><option>Compression</option></select></label><label><span>Score minimal</span><input type="range" min="50" max="95" defaultValue="70" /></label><button className="button primary compact"><Zap size={13} />Scanner</button></div>
        <div className="market-table screener-table"><div className="market-table-row head"><span>Actif</span><span>Score IA</span><span>Régime</span><span>Volatilité</span><span>Volume relatif</span><span>Signal</span><span /></div>{screener.map((item) => <div className="market-table-row" key={item.symbol}><span><i className="asset-mark">{item.symbol.slice(0,2)}</i><strong>{item.symbol}</strong></span><span><b className="score-meter"><i style={{ width: item.score + "%" }} /></b><strong>{item.score}</strong></span><span>{item.regime}</span><span>{item.volatility}</span><span>{item.volume}</span><span><em className="signal-pill">{item.signal}</em></span><button className="icon-button" aria-label={"Ajouter " + item.symbol}><Plus size={14} /></button></div>)}</div>
      </div>}

      {tab === "alerts" && <div className="alerts-layout">
        <article><header><span><Bell size={15} />Alertes actives</span><button className="button secondary compact"><Plus size={13} />Créer</button></header>{[["BTC/USD","> 120,000","Proche · 1.3%"],["NVDA","Volume > 2×","Déclenchée"],["EUR/USD","< 1.0900","En attente"]].map(([asset, condition, state], index) => <div className="alert-row" key={asset}><span className={"alert-state " + (index === 1 ? "triggered" : "")}><Bell size={13} /></span><p><strong>{asset}</strong><small>{condition}</small></p><em>{state}</em><label className="switch"><input type="checkbox" defaultChecked /><span /></label></div>)}</article>
        <article><header><span><CalendarDays size={15} />Calendrier économique</span><button className="icon-button" aria-label="Voir le calendrier"><ChevronRight size={14} /></button></header>{news.map((item) => <div className="calendar-row" key={item.title}><strong>{item.time}</strong><i className={item.impact} /><p><span>{item.title}</span><small>{item.detail}</small></p></div>)}</article>
        <article className="news-pulse"><header><span><Newspaper size={15} />News pulse</span><em>SIMULÉ</em></header><div><p><span>MACRO</span><strong>Les marchés attendent les minutes de la Fed</strong><small>Il y a 18 min · impact USD</small></p><p><span>CRYPTO</span><strong>Bitcoin teste une nouvelle zone de liquidité</strong><small>Il y a 34 min · volatilité élevée</small></p><p><span>EARNINGS</span><strong>Résultats technologiques cette semaine</strong><small>5 entreprises de la watchlist</small></p></div></article>
      </div>}

      {tab === "journal" && <div className="journal-layout">
        <article className="journal-score"><div className="performance-orbit"><span><strong>68%</strong><small>win rate</small></span></div><div><p className="section-kicker">30 derniers jours</p><h3>Discipline en progression</h3><span><CheckCircle2 size={13} />17 hypothèses documentées</span><span><AlertTriangle size={13} />3 entrées hors plan</span></div></article>
        <article className="journal-entry"><header><span><NotebookPen size={15} />Nouvelle entrée</span><em>Aujourd’hui · 15:24</em></header><textarea placeholder="Thèse, contexte, invalidation et apprentissage…" /><footer><button className="button secondary"><Sparkles size={13} />Structurer avec Heron</button><button className="button primary"><CheckCircle2 size={13} />Enregistrer</button></footer></article>
        <article className="journal-rules"><header><span><ShieldCheck size={15} />Règles actives</span></header><label><input type="checkbox" defaultChecked />Risque maximal de 1% par hypothèse</label><label><input type="checkbox" defaultChecked />Toujours définir l’invalidation</label><label><input type="checkbox" defaultChecked />Aucun ordre avant événement macro</label><button className="text-button">Modifier les règles <ChevronRight size={13} /></button></article>
      </div>}
    </section>

    <div className="trading-note"><CircleDollarSign size={15} /><span>Les prix, positions, signaux et actions sont des données de démonstration. Le widget TradingView public nécessite Internet.</span></div>
  </div>;
}

function Sparkline({ tone }: { tone: string }) {
  return <svg className={"market-sparkline " + tone} viewBox="0 0 90 34" role="img" aria-label="Tendance simulée sur la séance"><path d="M2 29 C14 26,18 30,27 22 S42 16,49 19 S63 6,70 11 S81 4,88 6" /><path className="fill" d="M2 29 C14 26,18 30,27 22 S42 16,49 19 S63 6,70 11 S81 4,88 6 L88 34 L2 34 Z" /></svg>;
}

function TradingViewWidget({ symbol, interval, theme }: { symbol: string; interval: string; theme: "dark" | "light" }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.text = JSON.stringify({
      autosize: true, symbol, interval, timezone: "Europe/Paris", theme,
      style: "1", locale: "fr", backgroundColor: theme === "light" ? "#f7fbff" : "#0d111b",
      gridColor: theme === "light" ? "rgba(45, 95, 128, 0.08)" : "rgba(116, 231, 247, 0.04)",
      hide_side_toolbar: true, allow_symbol_change: true, save_image: false,
      calendar: false, support_host: "https://www.tradingview.com",
    });
    container.current.appendChild(widget);
    container.current.appendChild(script);
  }, [symbol, interval, theme]);
  return <div className={"tradingview-widget-container tv-host theme-" + theme} ref={container} aria-label={"Graphique TradingView pour " + symbol}><div className="tv-loading"><CandlestickChart size={22} /><span>Chargement du graphique…</span></div></div>;
}
