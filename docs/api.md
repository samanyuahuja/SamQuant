# SamQuant API Guide

This guide documents the main public interfaces. Private helpers beginning with
`_` are implementation details and may change without notice.

## Market Data

### `get_ohlcv(symbol, start, end, interval="1d", data_dir=..., refresh=False, auto_adjust=True)`

Returns a validated `pandas.DataFrame` indexed by timestamps with `Open`, `High`,
`Low`, `Close`, and `Volume`. It loads a matching CSV cache when available and
otherwise downloads and stores the data. For daily Yahoo data, `end` is exclusive.

Adjusted and unadjusted requests use different cache paths. Keep
`auto_adjust=True` for the dashboard's return-oriented historical simulations.

### `download_ohlcv(...)`

Downloads one symbol directly from Yahoo Finance, normalizes provider columns,
removes incomplete provider rows, validates the result, and returns it without
writing a cache file.

### `validate_ohlcv(data)`

Returns `None` for valid data and raises `MarketDataError` for an empty frame,
missing columns, invalid timestamps, missing values, nonnumeric values, impossible
OHLC relationships, nonpositive prices, or negative volume.

### `save_ohlcv(data, path)` / `load_ohlcv(path)`

Persist or read a CSV while enforcing the same OHLCV contract at both boundaries.

## Strategies

All strategies expose:

```python
generate_target_weights(market_data: Mapping[str, DataFrame]) -> DataFrame
```

The returned frame has the same timestamps as the input, one normalized column
per symbol, nonnegative weights, and row sums no greater than `1.0`.

- `MovingAverageCrossoverStrategy(short_window=50, long_window=200)`
- `MeanReversionStrategy(lookback_window=20, entry_z_score=-2, exit_z_score=0)`
- `MomentumStrategy(lookback_window=126, top_n=1, rebalance_frequency=21, require_positive_returns=True)`

Invalid configuration or misaligned data raises `StrategyError`.

Research interfaces call `evaluate(market_data)`, which returns the same target
weights plus causal indicator frames. `generate_target_weights` delegates to
this method, so execution and visualization cannot drift apart.

## Trading Engine

### `Order(symbol, side, quantity)`

An immutable request with a normalized symbol, `OrderSide.BUY` or
`OrderSide.SELL`, and a finite positive quantity.

### `Portfolio(initial_cash, commission_rate=0, fixed_fee=0)`

Owns mutable cash, long positions, and executed trades. `execute(order, price,
timestamp)` fills an order completely or raises a portfolio error. `total_value`
marks cash and holdings using supplied prices.

### `Backtester(initial_cash=100000, commission_rate=0.001, fixed_fee=0, slippage_bps=0)`

`run(market_data, target_weights)` validates aligned inputs, shifts targets by
one bar, executes at the next opening price, values holdings at each close, and
returns `BacktestResult`.

### `BacktestResult`

An immutable result containing:

- `equity_curve`: total portfolio value by timestamp
- `cash_curve`: unused cash by timestamp
- `positions`: held quantities by timestamp and symbol
- `trades`: immutable executed `Trade` records
- `final_value`: final point on the equity curve

## Analytics

`calculate_metrics(result, periods_per_year=252, risk_free_rate=0)` returns an
immutable `PerformanceMetrics` object containing:

- `total_return`
- `annualized_return`
- `annualized_volatility`
- `sharpe_ratio`
- `maximum_drawdown`
- `win_rate`

Individual metric functions are also public. Undefined quantities such as a
Sharpe ratio with zero volatility or win rate with no completed sale return
`NaN`, not a misleading zero.

## Application Service

- `parse_symbols` normalizes comma-separated US, NSE, or BSE tickers.
- `generate_demo_market_data` creates deterministic valid OHLCV frames.
- `load_market_data` applies date, symbol, and live-provider limits.
- `run_backtest` joins strategy evaluation, engine execution, and analytics.
- `run_equal_weight_benchmark` uses the same delayed execution engine.

## HTTP API

- `GET /api/v1/health` reports service readiness.
- `GET /api/v1/catalog` lists enabled markets, strategies, sources, and limits.
- `POST /api/v1/backtests` accepts validated research inputs and returns OHLCV,
  indicators, signals, portfolio history, metrics, trades, assumptions, and warnings.

Dates use ISO `YYYY-MM-DD` strings. Undefined metrics become JSON `null` rather
than invalid `NaN` values. Errors contain a code, natural message, affected
fields, and request ID without exposing Python tracebacks.

## Dashboard Pipeline

- `parse_symbols` normalizes comma-separated US, NSE, or BSE tickers.
- `generate_demo_market_data` creates deterministic valid OHLCV frames.
- `build_strategy` maps dashboard choices to strategy objects.
- `run_dashboard_backtest` runs strategy, engine, and analytics layers.
- `run_strategy_comparison` adds all strategies and the equal-weight benchmark.

The dashboard module keeps backward-compatible names while delegating research
orchestration to `samquant.application`.
