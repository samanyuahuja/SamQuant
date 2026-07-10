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
quantlab/
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

