# SamQuant

SamQuant is a modular algorithmic trading system and backtesting engine built for learning, research discipline, and portfolio-quality software engineering.

The project prioritizes correctness, readable architecture, and realistic backtesting assumptions over claims of profitability.

## Goals

- Download, validate, and store historical market data.
- Run trading strategies on historical OHLCV data.
- Simulate orders, positions, cash, fees, and portfolio value.
- Analyze performance and risk metrics.
- Display results in a Streamlit dashboard.

## Architecture

```text
samquant/
├── data/
│   └── market_data.py
├── engine/
│   ├── backtester.py
│   ├── order.py
│   └── portfolio.py
├── strategies/
│   ├── mean_reversion.py
│   ├── momentum.py
│   └── moving_average.py
├── analytics/
│   └── metrics.py
└── dashboard/
    └── app.py
```

## Phase Roadmap

1. Project structure and environment setup.
2. Market data download, validation, and local storage.
3. Trading engine with orders, portfolio accounting, transaction fees, and backtesting.
4. Strategy implementations: moving average crossover, mean reversion, and momentum.
5. Performance and risk analytics.
6. Streamlit dashboard for charts, trades, comparisons, and metrics.
7. Tests, documentation, example results, and polish.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
```

## Research Standards

- Avoid look-ahead bias by using only information available at the simulated decision time.
- Avoid survivorship bias when defining tradable universes.
- Include realistic transaction costs and document assumptions.
- Treat backtest results as research output, not evidence of guaranteed future performance.

## Market Data

Phase 2 adds a reusable OHLCV data layer in `samquant/data/market_data.py`.

```python
from samquant.data.market_data import get_ohlcv

prices = get_ohlcv("AAPL", start="2020-01-01", end="2024-01-01")
```

The data layer:

- downloads historical OHLCV data with `yfinance`;
- validates required price and volume columns before use;
- rejects empty, unsorted, duplicated, missing, or internally inconsistent data;
- stores CSV files under `data/raw/ohlcv/`;
- keeps live downloads out of unit tests so tests stay deterministic.

## Trading Engine

Phase 3 adds validated orders, portfolio accounting, transaction costs, and a
long-only historical backtester in `samquant/engine/`.

```python
import pandas as pd

from samquant.engine import Backtester

targets = pd.DataFrame({"AAPL": [0.0, 1.0, 1.0, 0.0]}, index=prices.index)
result = Backtester(
    initial_cash=100_000,
    commission_rate=0.001,
    slippage_bps=5,
).run({"AAPL": prices}, targets)
```

Each target row represents information available after that day's bar. The
backtester shifts targets by one bar and trades at the next opening price, which
prevents same-bar look-ahead bias. It executes sales before purchases, limits
buys to available cash, records every fee, and marks positions at closing prices.

The first engine version intentionally uses aligned daily data, fractional
quantities, and long-only weights whose total cannot exceed 100%. These explicit
constraints keep the accounting testable while leaving room for later execution
models, short selling, and partial fills.
