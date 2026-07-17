# Phase 5 Human Validation

## 1. Generate a strategy from an objective

1. Open **Strategy Factory**.
2. Enter a momentum objective that explicitly mentions completed daily bars and costs.
3. Optionally link an existing hypothesis.
4. Click **Generate strategy**.
5. Repeat with an objective containing “mean reversion” or “z-score”.

Expected: Orbit creates immutable version 1 definitions with different templates, readable theses, declarative code, and a one-bar signal lag.

## 2. Prove deterministic data snapshots

1. Set seed `42` and click **Create snapshot** twice.
2. Confirm only one snapshot with that checksum is used.
3. Change the seed to `43` and create another snapshot.

Expected: the same seed produces the same checksum; a different seed produces a different immutable dataset.

## 3. Run a complete backtest

1. Select a strategy and the seed-42 dataset.
2. Click **Run reproducible backtest**.
3. Inspect Run Detail.

Expected: status is completed, the report is available, costs are 2 bps plus 1 bp slippage, the checksum is visible, and all four validations exist.

## 4. Inspect warnings rather than only returns

Review trade count, maximum drawdown, static warnings, bootstrap interval, Monte Carlo range, and profitable walk-forward folds.

Expected: weak evidence remains visible even when total return is positive. No screen labels a candidate as safe for paper or live trading.

## 5. Compare compatible strategies

1. Run both momentum and mean-reversion strategies on the same dataset.
2. Open **Compare**, select the two runs, and compare them.
3. Open **Correlation**, select the same runs, and calculate the matrix.

Expected: comparison ranks by Sharpe and the diagonal correlation is `1.00`.

## 6. Reject an incompatible comparison

1. Run a strategy on seed 43.
2. Try to compare it with a seed-42 run.

Expected: Orbit refuses the comparison and explains that the data or cost assumptions differ.

## 7. Audit the Alpha Zoo

Open **Alpha Zoo** and search for “trend”, “reversion”, and “volatility”.

Expected: only moving-average crossover and rolling z-score are marked executable. Research and planned factors do not pretend to run.

## 8. Persistence check

Restart Orbit, reopen Backtests, and select the earlier run.

Expected: strategy snapshot, checksum, metrics, validations, trades, equity, warnings, and report health are unchanged.
