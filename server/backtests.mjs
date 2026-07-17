import { createHash } from "node:crypto";

const YEAR_BARS = { "1d": 252, "1h": 252 * 6.5, "15m": 252 * 26 };

export class BacktestError extends Error {
  constructor(message, code = "backtest_failed") {
    super(message);
    this.name = "BacktestError";
    this.code = code;
  }
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function checksum(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

function rng(seed) {
  let state = Math.abs(Number(seed) || 1) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function gaussian(random) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

export function createSyntheticDataset({ seed = 42, rows = 756, symbol = "SYNTH", frequency = "1d", drift = 0.00025, volatility = 0.012 } = {}) {
  const random = rng(seed);
  const data = [];
  let close = 100;
  const start = Date.UTC(2020, 0, 1);
  for (let index = 0; index < rows; index += 1) {
    const regime = index < rows / 3 ? 1 : index < (rows * 2) / 3 ? -0.3 : 0.7;
    const change = drift * regime + volatility * gaussian(random);
    const open = close;
    close = Math.max(0.01, close * Math.exp(change));
    const spread = Math.abs(gaussian(random)) * volatility * open * 0.45;
    data.push({
      timestamp: new Date(start + index * 86_400_000).toISOString(),
      open: round(open), high: round(Math.max(open, close) + spread), low: round(Math.max(0.01, Math.min(open, close) - spread)),
      close: round(close), volume: Math.round(1_000_000 * (0.7 + random() * 0.6)),
    });
  }
  return { name: `Synthetic ${symbol} seed ${seed}`, source: "synthetic", symbol, frequency, seed, data, checksum: checksum(data) };
}

export function validateDataset(data) {
  if (!Array.isArray(data) || data.length < 30) throw new BacktestError("Dataset must contain at least 30 bars", "dataset_too_short");
  let previous = "";
  for (const [index, bar] of data.entries()) {
    if (!bar || !Number.isFinite(bar.close) || bar.close <= 0 || !Number.isFinite(bar.open) || !Number.isFinite(bar.high) || !Number.isFinite(bar.low)) {
      throw new BacktestError(`Invalid OHLC data at row ${index}`, "corrupted_dataset");
    }
    const timestamp = new Date(bar.timestamp).toISOString();
    if (previous && timestamp <= previous) throw new BacktestError("Dataset timestamps must be strictly increasing", "lookahead_risk");
    previous = timestamp;
  }
  return true;
}

export function strategyFromObjective(objective) {
  const normalized = String(objective).toLowerCase();
  const meanReversion = /mean|revert|oversold|overbought|range|z-score|zscore/.test(normalized);
  if (meanReversion) return {
    name: "Objective Mean Reversion",
    thesis: "Extreme deviations from a rolling mean revert after costs when signals use only completed bars.",
    template: "mean_reversion",
    config: { window: 20, entryZ: 1.5, exitZ: 0.35, allowShort: true, signalLag: 1 },
    code: "z = zscore(close.shift(1), window)\nposition = long if z < -entryZ else short if z > entryZ else exit when abs(z) < exitZ",
  };
  return {
    name: "Objective Trend Momentum",
    thesis: "Persistent price trends can be captured by a lagged fast/slow moving-average crossover after explicit costs.",
    template: "momentum",
    config: { fastWindow: 20, slowWindow: 80, allowShort: false, signalLag: 1 },
    code: "fast = mean(close.shift(1), fastWindow)\nslow = mean(close.shift(1), slowWindow)\nposition = 1 if fast > slow else 0",
  };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function deviation(values, average = mean(values)) {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function signalAt(closes, index, template, config, currentPosition) {
  const lag = config.signalLag;
  const end = index - lag + 1;
  if (end <= 0) return 0;
  if (template === "momentum") {
    if (end < config.slowWindow) return 0;
    const fast = mean(closes.slice(end - config.fastWindow, end));
    const slow = mean(closes.slice(end - config.slowWindow, end));
    return fast > slow ? 1 : config.allowShort ? -1 : 0;
  }
  if (end < config.window) return 0;
  const window = closes.slice(end - config.window, end);
  const average = mean(window);
  const std = deviation(window, average);
  const z = std ? (window.at(-1) - average) / std : 0;
  if (Math.abs(z) < config.exitZ) return 0;
  if (z <= -config.entryZ) return 1;
  if (z >= config.entryZ) return config.allowShort ? -1 : 0;
  return currentPosition;
}

export function validateBacktestConfig(template, strategyConfig, runConfig) {
  if (!Number.isInteger(strategyConfig.signalLag) || strategyConfig.signalLag < 1) throw new BacktestError("Signals must lag market data by at least one bar", "lookahead_risk");
  if (template === "momentum" && (!(strategyConfig.fastWindow > 1) || !(strategyConfig.slowWindow > strategyConfig.fastWindow))) throw new BacktestError("Momentum windows are invalid", "invalid_strategy_config");
  if (template === "mean_reversion" && (!(strategyConfig.window > 2) || !(strategyConfig.entryZ > strategyConfig.exitZ) || strategyConfig.exitZ < 0)) throw new BacktestError("Mean-reversion thresholds are invalid", "invalid_strategy_config");
  if (!(runConfig.initialCapital > 0) || runConfig.costBps < 0 || runConfig.costBps > 1_000 || runConfig.slippageBps < 0 || runConfig.slippageBps > 1_000) throw new BacktestError("Backtest cost configuration is invalid", "invalid_backtest_config");
}

export function calculateMetrics(returns, equity, trades, frequency = "1d", exposureBars = 0) {
  const periods = YEAR_BARS[frequency] || 252;
  const average = mean(returns);
  const std = deviation(returns, average);
  const downside = deviation(returns.filter((value) => value < 0), 0);
  let peak = equity[0] || 1;
  let maxDrawdown = 0;
  for (const value of equity) { peak = Math.max(peak, value); maxDrawdown = Math.min(maxDrawdown, value / peak - 1); }
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const totalReturn = equity.length > 1 ? equity.at(-1) / equity[0] - 1 : 0;
  const years = Math.max(returns.length / periods, 1 / periods);
  return {
    totalReturn: round(totalReturn), annualizedReturn: round((1 + totalReturn) ** (1 / years) - 1),
    annualizedVolatility: round(std * Math.sqrt(periods)), sharpe: round(std ? average / std * Math.sqrt(periods) : 0),
    sortino: round(downside ? average / downside * Math.sqrt(periods) : 0), maxDrawdown: round(maxDrawdown),
    winRate: round(trades.length ? wins.length / trades.length : 0), profitFactor: grossLoss ? round(grossProfit / grossLoss) : grossProfit ? null : 0,
    tradeCount: trades.length, exposure: round(returns.length ? exposureBars / returns.length : 0), endingEquity: round(equity.at(-1) || 0),
  };
}

export function runBacktest({ strategy, dataset, runConfig }) {
  validateDataset(dataset.data);
  validateBacktestConfig(strategy.template, strategy.config, runConfig);
  const closes = dataset.data.map((bar) => bar.close);
  const returns = [0];
  const equity = [runConfig.initialCapital];
  const trades = [];
  let position = 0;
  let entryIndex = null;
  let entryPrice = null;
  let exposureBars = 0;
  const costRate = (runConfig.costBps + runConfig.slippageBps) / 10_000;
  for (let index = 1; index < closes.length; index += 1) {
    const nextPosition = signalAt(closes, index, strategy.template, strategy.config, position);
    const turnover = Math.abs(nextPosition - position);
    const marketReturn = closes[index] / closes[index - 1] - 1;
    const netReturn = position * marketReturn - turnover * costRate;
    returns.push(round(netReturn));
    equity.push(round(equity.at(-1) * (1 + netReturn)));
    if (position !== 0) exposureBars += 1;
    if (nextPosition !== position) {
      if (position !== 0 && entryIndex !== null) trades.push({ entryIndex, exitIndex: index, side: position > 0 ? "long" : "short", entryPrice, exitPrice: closes[index], pnl: round((closes[index] / entryPrice - 1) * position - 2 * costRate) });
      entryIndex = nextPosition === 0 ? null : index;
      entryPrice = nextPosition === 0 ? null : closes[index];
      position = nextPosition;
    }
  }
  if (position !== 0 && entryIndex !== null) trades.push({ entryIndex, exitIndex: closes.length - 1, side: position > 0 ? "long" : "short", entryPrice, exitPrice: closes.at(-1), pnl: round((closes.at(-1) / entryPrice - 1) * position - costRate) });
  const warnings = [];
  if (trades.length < 20) warnings.push("Low trade count: statistical conclusions are fragile.");
  if (runConfig.costBps === 0 && runConfig.slippageBps === 0) warnings.push("No transaction costs or slippage configured.");
  const metrics = calculateMetrics(returns, equity, trades, dataset.frequency, exposureBars);
  if (metrics.sharpe > 3) warnings.push("Unusually high Sharpe ratio: inspect leakage and overfitting risk.");
  return { returns, equity, trades, metrics, warnings };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)))] || 0;
}

export function validateResults(result, { seed = 991, samples = 200, frequency = "1d" } = {}) {
  const random = rng(seed);
  const raw = result.returns.slice(1);
  const compound = (values) => values.reduce((equity, value) => equity * (1 + value), 1) - 1;
  const pathDrawdown = (values) => {
    let equity = 1; let peak = 1; let drawdown = 0;
    for (const value of values) { equity *= 1 + value; peak = Math.max(peak, equity); drawdown = Math.min(drawdown, equity / peak - 1); }
    return drawdown;
  };
  const monteCarloDrawdowns = [];
  const bootstrapSharpes = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const shuffled = [...raw];
    for (let index = shuffled.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]; }
    monteCarloDrawdowns.push(pathDrawdown(shuffled));
    const resampled = Array.from({ length: raw.length }, () => raw[Math.floor(random() * raw.length)] || 0);
    const std = deviation(resampled);
    bootstrapSharpes.push(std ? mean(resampled) / std * Math.sqrt(YEAR_BARS[frequency] || 252) : 0);
  }
  const foldSize = Math.floor(raw.length / 5);
  const folds = Array.from({ length: 5 }, (_, index) => compound(raw.slice(index * foldSize, index === 4 ? raw.length : (index + 1) * foldSize)));
  const staticWarnings = [...result.warnings];
  const validations = [
    { kind: "static", status: staticWarnings.some((warning) => /leak|lookahead/i.test(warning)) ? "failed" : staticWarnings.length ? "warning" : "passed", summary: staticWarnings.length ? `${staticWarnings.length} risk warning(s)` : "No static integrity warning", metrics: { signalLagEnforced: true, warnings: staticWarnings.length }, warnings: staticWarnings },
    { kind: "monte_carlo", status: percentile(monteCarloDrawdowns, 0.05) < -0.3 ? "warning" : "passed", summary: "Randomized return-path drawdown stress test", metrics: { samples, p05Drawdown: round(percentile(monteCarloDrawdowns, 0.05)), medianDrawdown: round(percentile(monteCarloDrawdowns, 0.5)), p95Drawdown: round(percentile(monteCarloDrawdowns, 0.95)) }, warnings: [] },
    { kind: "bootstrap", status: percentile(bootstrapSharpes, 0.05) <= 0 ? "warning" : "passed", summary: "Bootstrap confidence interval for Sharpe", metrics: { samples, p05Sharpe: round(percentile(bootstrapSharpes, 0.05)), medianSharpe: round(percentile(bootstrapSharpes, 0.5)), p95Sharpe: round(percentile(bootstrapSharpes, 0.95)) }, warnings: [] },
    { kind: "walk_forward", status: folds.filter((value) => value > 0).length >= 3 ? "passed" : "warning", summary: "Five sequential out-of-sample folds", metrics: { folds: folds.map(round), profitableFolds: folds.filter((value) => value > 0).length }, warnings: [] },
  ];
  return validations;
}

export function compareBacktests(backtests) {
  if (!Array.isArray(backtests) || backtests.length < 2) throw new BacktestError("Select at least two completed backtests", "comparison_too_small");
  if (backtests.some((backtest) => backtest.status !== "completed" || !backtest.metrics)) throw new BacktestError("Only completed backtests can be compared", "incomplete_backtest");
  const reference = backtests[0];
  for (const candidate of backtests.slice(1)) {
    if (candidate.dataSnapshot.checksum !== reference.dataSnapshot.checksum || candidate.config.initialCapital !== reference.config.initialCapital || candidate.config.costBps !== reference.config.costBps || candidate.config.slippageBps !== reference.config.slippageBps) {
      throw new BacktestError("Backtests use incompatible data or cost assumptions", "incompatible_comparison");
    }
  }
  return [...backtests].sort((left, right) => right.metrics.sharpe - left.metrics.sharpe);
}

export function correlationMatrix(backtests) {
  const compatible = compareBacktests(backtests);
  const labels = compatible.map((backtest) => backtest.strategySnapshot.name);
  const matrix = compatible.map((left) => compatible.map((right) => round(correlation(left.returns, right.returns))));
  return { labels, matrix };
}

function correlation(left, right) {
  if (left.length !== right.length || left.length < 2) throw new BacktestError("Return series are incompatible", "incompatible_comparison");
  const leftMean = mean(left); const rightMean = mean(right);
  let numerator = 0; let leftVariance = 0; let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) { const a = left[index] - leftMean; const b = right[index] - rightMean; numerator += a * b; leftVariance += a * a; rightVariance += b * b; }
  return leftVariance && rightVariance ? numerator / Math.sqrt(leftVariance * rightVariance) : left === right ? 1 : 0;
}

function round(value) {
  return Number(Number(value).toFixed(8));
}

export const alphaZoo = Object.freeze([
  { id: "ma-crossover", family: "Trend", name: "Moving-average crossover", description: "Lagged fast/slow trend filter", status: "available" },
  { id: "time-series-momentum", family: "Trend", name: "Time-series momentum", description: "Directional persistence over a fixed horizon", status: "research" },
  { id: "zscore-reversion", family: "Mean reversion", name: "Rolling z-score", description: "Deviation from a rolling mean", status: "available" },
  { id: "rsi-reversion", family: "Mean reversion", name: "RSI reversion", description: "Bounded oscillator reversal", status: "research" },
  { id: "breakout", family: "Price action", name: "Range breakout", description: "Prior-window high or low breach", status: "research" },
  { id: "volatility-carry", family: "Volatility", name: "Volatility carry", description: "Compensation for volatility risk", status: "planned" },
  { id: "cross-sectional-value", family: "Cross-sectional", name: "Relative value", description: "Ranked valuation spread", status: "planned" },
  { id: "quality", family: "Fundamental", name: "Quality composite", description: "Profitability and balance-sheet strength", status: "planned" },
]);
