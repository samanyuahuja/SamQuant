# Presenting SamQuant

## 30-Second Elevator Pitch

SamQuant is a modular Python backtesting platform that downloads and validates
market data, converts three strategy models into portfolio targets, and simulates
next-open execution with fees and slippage. It tracks positions and cash, reports
risk-adjusted performance, and presents results in Streamlit. I designed the
layers so strategies, execution, analytics, and the UI can be tested and extended
independently, with explicit protections against same-bar look-ahead bias.

## Technical Project Description

SamQuant is an event-ordered historical trading simulator built with Python,
pandas, NumPy, Plotly, and Streamlit. Its market-data boundary validates adjusted
OHLCV data and deterministic caches. Strategy classes generate aligned target
weights, while a long-only engine delays targets to the next market open,
calculates affordable orders, applies trading costs, and maintains auditable
portfolio state. A separate analytics layer calculates return, volatility,
Sharpe ratio, drawdown, and fee-aware FIFO win rate. Pytest causality tests,
coverage enforcement, linting, and GitHub Actions support release quality.

## Resume-Ready Bullet Points

- Built a modular Python algorithmic-trading and backtesting platform spanning
  market-data validation, strategy signals, portfolio accounting, analytics, and
  an interactive Streamlit dashboard.
- Designed a next-open execution model with one-bar signal delays, transaction
  fees, adverse slippage, cash constraints, and causality tests to reduce
  look-ahead bias in historical simulations.
- Implemented moving-average, rolling z-score mean-reversion, and cross-sectional
  momentum strategies using pandas and NumPy with reusable target-weight APIs.
- Added automated GitHub Actions checks across Python versions with Ruff, pytest,
  deterministic UI smoke tests, and an enforced coverage threshold.

Use only bullets you can explain line by line. Do not claim profitability,
production trading, or live execution.

## Strong Interview Talking Points

1. Why strategies return target weights instead of orders.
2. Why signals are shifted before next-open execution.
3. Why portfolio accounting lives in one mutable object while trades are immutable.
4. Why adjusted and unadjusted market data require separate cache identities.
5. Why undefined Sharpe ratios and win rates return `NaN` instead of zero.
6. Why the Streamlit pipeline is separate from rendering code.
7. What Version 1 intentionally does not model and how Version 2 could add it.

## Screenshots And GIFs To Include

Use real output from the running application. Recommended portfolio media:

- A desktop overview showing controls, metrics, equity, and drawdown.
- A strategy-comparison view showing all models on the same normalized scale.
- A trade-table view where fees and adverse fills are visible.
- A short screen recording that changes a strategy input and opens each result tab.
- One NSE example using ordinary symbols that SamQuant converts to `.NS` tickers.

Avoid cropped metrics without assumptions, fictional brokerage screens, or images
that imply the system trades real money.
