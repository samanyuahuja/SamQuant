# Using SamQuant

## Install And Start

```bash
git clone https://github.com/samanyuahuja/SamQuant.git
cd SamQuant
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m streamlit run samquant/dashboard/app.py
```

Windows PowerShell users activate with `.venv\Scripts\Activate.ps1`.

## Dashboard Inputs

### Data source

- **Demo data** creates repeatable fictional prices. Use it to learn the app or
  verify behavior without internet access.
- **Yahoo Finance** downloads historical adjusted OHLCV data and caches it under
  `data/raw/ohlcv/`.

### Market and ticker symbols

Choose `US`, `India (NSE)`, or `India (BSE)`, then enter comma-separated symbols.

| Market | Input example | Provider symbols used |
| --- | --- | --- |
| US | `AAPL, MSFT, NVDA` | unchanged |
| India NSE | `RELIANCE, TCS, INFY` | `.NS` suffix added |
| India BSE | `RELIANCE, TCS, INFY` | `.BO` suffix added |

Complete symbols such as `RELIANCE.NS` and indices such as `^NSEI` are preserved.

### Dates

The start and end dates choose the historical research window. More history is
needed than the strategy's longest lookback. Yahoo's daily `end` date is
exclusive internally; the dashboard includes the date selected by the user.

### Strategy settings

- **Moving average:** The short average reacts quickly; the long average
  represents the slower trend. The short window must be smaller.
- **Mean reversion:** The lookback defines the recent mean and standard deviation.
  Entry and exit z-scores define when a low price is unusual and when it recovered.
- **Momentum:** The lookback measures trailing return, `top_n` selects winners,
  and rebalance frequency controls how long weights are held.

### Execution and analytics settings

- **Starting cash:** Initial simulated portfolio value.
- **Commission:** Percentage fee charged on each trade's value.
- **Fixed fee:** Flat amount charged per execution.
- **Slippage:** Adverse price movement in basis points; 100 bps equals 1%.
- **Risk-free rate:** Annual comparison rate used by the Sharpe ratio.

## Reading Results

- **Overview:** Equity growth, drawdown, final value, trade count, and holdings.
- **Trades:** Every simulated buy and sell, including quantity, fill, and fee.
- **Strategy comparison:** All three strategies and an equal-weight benchmark,
  rebased to the same starting value.
- **Data and signals:** Closing prices and the most recent target weights.

Total return measures start-to-finish growth. Annualized return estimates a
one-year compounded rate. Volatility measures variability. Sharpe compares
average excess return with volatility. Maximum drawdown measures the deepest
peak-to-trough decline. Win rate counts profitable completed sell executions
using FIFO cost basis and fees.

## Run A Backtest In Python

```python
from samquant.analytics import calculate_metrics
from samquant.data.market_data import get_ohlcv
from samquant.engine import Backtester
from samquant.strategies import MomentumStrategy

market_data = {
    symbol: get_ohlcv(symbol, "2020-01-01", "2025-01-01")
    for symbol in ("AAPL", "MSFT", "NVDA")
}
strategy = MomentumStrategy(lookback_window=126, top_n=2, rebalance_frequency=21)
weights = strategy.generate_target_weights(market_data)
result = Backtester(commission_rate=0.001, slippage_bps=5).run(market_data, weights)
metrics = calculate_metrics(result)
```

Assets supplied directly to strategies and the backtester must already have
identical timestamps. The dashboard pipeline can align downloaded symbols to
their shared dates.

## Common Problems

- **Not enough trades:** Use a longer date range or a shorter valid lookback.
- **Unknown Indian symbol:** Confirm the exchange and Yahoo Finance ticker.
- **No shared timestamps:** One asset may have missing or incompatible history.
- **Download failure:** Retry later or use deterministic demo data.
- **Old data appears:** Set `refresh=True` when calling `get_ohlcv` in Python.

## Research Warning

Backtests describe a historical simulation, not a forecast. Compare multiple
periods, use point-in-time universes, reserve out-of-sample data, and document
every cost and parameter assumption before drawing conclusions.
