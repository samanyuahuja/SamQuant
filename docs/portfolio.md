# Presenting SamQuant

## 30-Second Elevator Pitch

SamQuant is a modular Python backtesting platform that downloads and validates
market data, converts three strategy models into portfolio targets, and simulates
next-open execution with fees and slippage. It tracks positions and cash, reports
risk-adjusted performance, and presents typed results through FastAPI, Next.js,
and Streamlit. I designed each layer so research logic, execution, analytics,
and interfaces can be tested independently, with explicit protection against
same-bar look-ahead bias.

## Technical Project Description

SamQuant is an event-ordered historical trading simulator built with Python,
pandas, NumPy, FastAPI, Next.js, and Streamlit. Its market-data boundary validates
adjusted OHLCV data and deterministic caches. Strategy classes generate aligned target
weights, while a long-only engine delays targets to the next market open,
calculates affordable orders, applies trading costs, and maintains auditable
portfolio state. A separate analytics layer calculates return, volatility,
Sharpe ratio, drawdown, and fee-aware FIFO win rate. A typed API serves a
responsive research terminal without duplicating financial formulas in the
browser. Pytest, Playwright, coverage gates, and GitHub Actions support release quality.

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
- Built a Next.js research terminal with typed FastAPI results, interactive
  financial charts, responsive controls, accessible data alternatives, and
  deterministic visual regression coverage.

Use only bullets you can explain line by line. Do not claim profitability,
production trading, or live execution.

## Strong Interview Talking Points

1. Why strategies return target weights instead of orders.
2. Why signals are shifted before next-open execution.
3. Why portfolio accounting lives in one mutable object while trades are immutable.
4. Why adjusted and unadjusted market data require separate cache identities.
5. Why undefined Sharpe ratios and win rates return `NaN` instead of zero.
6. Why FastAPI, Next.js, and Streamlit all depend on one application service.
7. Why the browser renders results instead of recalculating financial metrics.
8. What Version 1 intentionally does not model and how Version 2 could add it.

## Screenshots And GIFs To Include

Use real output from the running application. Recommended portfolio media:

- A desktop overview showing controls, metrics, equity, and drawdown.
- A strategy-comparison view showing all models on the same normalized scale.
- A trade-table view where fees and adverse fills are visible.
- A short screen recording that changes a strategy input and opens each result tab.
- One NSE example using ordinary symbols that SamQuant converts to `.NS` tickers.

Avoid cropped metrics without assumptions, fictional brokerage screens, or images
that imply the system trades real money.
