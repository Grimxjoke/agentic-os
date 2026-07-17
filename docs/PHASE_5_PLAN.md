# Phase 5 Plan — Strategy Factory and Backtests

## Outcome

Phase 5 provides an offline, deterministic research path from a natural-language objective to a reproducible backtest report. It does not claim that synthetic results represent live market performance and it does not authorize paper or live trading.

## Delivered vertical slices

### Strategy Factory

- Convert an objective into one of two executable templates: lagged momentum or rolling z-score mean reversion.
- Persist immutable strategy versions with objective, thesis, template, declarative code, and bounded parameters.
- Link a strategy to a hypothesis without mutating the hypothesis history.
- Require a signal lag of at least one completed bar.

### Dataset snapshots

- Generate deterministic OHLCV fixtures from an explicit seed.
- Persist every bar, symbol, frequency, date range, row count, and SHA-256 checksum.
- Deduplicate identical snapshots by checksum.
- Run without network access.

### Reproducible backtests

- Snapshot the exact strategy version, dataset identity, initial capital, costs, slippage, and validation seed.
- Calculate net equity, returns, closed trades, return, volatility, Sharpe, Sortino, drawdown, win rate, profit factor, and exposure.
- Persist a checksummed JSON report artifact outside the browser.
- Detect missing or corrupted report artifacts when a run is opened.
- Reconcile a backtest interrupted by a control-plane restart as failed.

### Statistical validation

- Static integrity and overfitting warnings.
- Monte Carlo return-path stress test.
- Bootstrap Sharpe confidence interval.
- Five sequential walk-forward folds.
- Explicit warnings for low trade count, omitted costs, or implausibly high Sharpe.

### Research surfaces

- Strategy Factory for objective, hypothesis, dataset, and execution.
- Backtest Run Detail for metrics, equity, snapshots, validations, warnings, and trades.
- Compare with compatibility enforcement.
- Correlation matrix on compatible net return series.
- Alpha Zoo with honest `available`, `research`, and `planned` states.

## Non-goals

- No arbitrary user code execution.
- No market-data download in CI or deterministic tests.
- No optimization loop, generations, or champion promotion; those belong to Phase 6.
- No paper or live order route.

## Exit criteria

- SQLite schema version 5 is idempotent.
- Deterministic fixture and repeated execution produce identical results.
- Lookahead, malformed chronology, and corrupt OHLC data fail closed.
- Known metrics match fixed expectations.
- Missing and corrupted artifacts are visible.
- Incompatible comparisons are rejected.
- Full build and test suite pass.
