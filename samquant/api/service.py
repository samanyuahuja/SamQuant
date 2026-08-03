"""Serialize SamQuant application results into a stable web contract."""

from __future__ import annotations

from collections.abc import Mapping
from math import isfinite
from typing import Any

import pandas as pd

from samquant import __version__
from samquant.api.models import BacktestRequest, StrategyId
from samquant.application import (
    MEAN_REVERSION,
    MOMENTUM,
    MOVING_AVERAGE,
    BacktestConfig,
    ResearchRun,
    load_market_data,
    parse_symbols,
    run_backtest,
    run_equal_weight_benchmark,
)

STRATEGY_LABELS = {
    StrategyId.MOVING_AVERAGE: MOVING_AVERAGE,
    StrategyId.MEAN_REVERSION: MEAN_REVERSION,
    StrategyId.MOMENTUM: MOMENTUM,
}


def run_request(
    request: BacktestRequest,
    *,
    request_id: str,
    allow_yahoo: bool,
) -> dict[str, Any]:
    """Run one validated request through the authoritative Python pipeline."""
    symbols = parse_symbols(",".join(request.symbols), request.market.value)
    market_data = load_market_data(
        source=request.data_source.value,
        symbols=symbols,
        start=request.start.isoformat(),
        end=request.end.isoformat(),
        allow_yahoo=allow_yahoo,
    )
    config = BacktestConfig(
        initial_cash=request.initial_cash,
        commission_rate=request.commission_rate,
        fixed_fee=request.fixed_fee,
        slippage_bps=request.slippage_bps,
        periods_per_year=request.periods_per_year,
        risk_free_rate=request.risk_free_rate,
    )
    strategy_name = STRATEGY_LABELS[request.strategy]
    parameters = _strategy_parameters(request)
    primary = run_backtest(market_data, strategy_name, config, parameters)
    benchmark = run_equal_weight_benchmark(market_data, config)
    return _serialize_report(
        request,
        request_id,
        market_data,
        primary,
        benchmark,
        parameters,
    )


def _strategy_parameters(request: BacktestRequest) -> dict[str, int | float | bool]:
    parameters = request.parameters
    if request.strategy is StrategyId.MOVING_AVERAGE:
        return {
            "short_window": parameters.short_window,
            "long_window": parameters.long_window,
        }
    if request.strategy is StrategyId.MEAN_REVERSION:
        return {
            "lookback_window": parameters.lookback_window,
            "entry_z_score": parameters.entry_z_score,
            "exit_z_score": parameters.exit_z_score,
        }
    return {
        "lookback_window": parameters.lookback_window,
        "top_n": parameters.top_n,
        "rebalance_frequency": parameters.rebalance_frequency,
        "require_positive_returns": parameters.require_positive_returns,
    }


def _serialize_report(
    request: BacktestRequest,
    request_id: str,
    market_data: Mapping[str, pd.DataFrame],
    primary: ResearchRun,
    benchmark: ResearchRun,
    parameters: Mapping[str, int | float | bool],
) -> dict[str, Any]:
    first_index = next(iter(market_data.values())).index
    drawdown = primary.result.equity_curve / primary.result.equity_curve.cummax() - 1.0
    signals = _signal_records(primary.target_weights)
    return {
        "metadata": {
            "requestId": request_id,
            "version": __version__,
            "dataSource": request.data_source.value,
            "market": request.market.value,
            "symbols": list(market_data),
            "start": first_index[0].date().isoformat(),
            "end": first_index[-1].date().isoformat(),
            "strategy": request.strategy.value,
            "strategyLabel": primary.strategy_name,
            "parameters": dict(parameters),
        },
        "market": {
            symbol: [
                {
                    "time": timestamp.date().isoformat(),
                    "open": _finite(row["Open"]),
                    "high": _finite(row["High"]),
                    "low": _finite(row["Low"]),
                    "close": _finite(row["Close"]),
                    "volume": _finite(row["Volume"]),
                }
                for timestamp, row in frame.iterrows()
            ]
            for symbol, frame in market_data.items()
        },
        "indicators": {
            name: {symbol: _series_records(frame[symbol]) for symbol in frame.columns}
            for name, frame in primary.evaluation.indicators.items()
        },
        "signals": signals,
        "portfolio": {
            "equity": _series_records(primary.result.equity_curve),
            "benchmark": _series_records(benchmark.result.equity_curve),
            "drawdown": _series_records(drawdown),
            "cash": _series_records(primary.result.cash_curve),
            "positions": {
                symbol: _series_records(primary.result.positions[symbol])
                for symbol in primary.result.positions.columns
            },
        },
        "metrics": _metric_values(primary),
        "benchmarkMetrics": _metric_values(benchmark),
        "trades": [
            {
                "time": trade.timestamp.date().isoformat(),
                "symbol": trade.order.symbol,
                "side": trade.order.side.value,
                "quantity": _finite(trade.order.quantity),
                "price": _finite(trade.price),
                "notional": _finite(trade.notional),
                "fee": _finite(trade.fee),
                "cashEffect": _finite(trade.cash_effect),
            }
            for trade in primary.result.trades
        ],
        "assumptions": {
            "signalTiming": "Signals use closing data and execute at the next bar's open.",
            "execution": "Orders fill completely with configurable fees and adverse slippage.",
            "universe": "The selected symbols are not a point-in-time index universe.",
            "data": (
                "Demo bars are deterministic and synthetic."
                if request.data_source.value == "demo"
                else "Yahoo Finance data is requested for local research use."
            ),
        },
        "warnings": [
            "Backtested results are hypothetical and are not investment advice.",
            "Taxes, liquidity limits, market impact, and partial fills are not modeled.",
        ],
    }


def _series_records(series: pd.Series) -> list[dict[str, Any]]:
    return [
        {"time": timestamp.date().isoformat(), "value": _finite(value)}
        for timestamp, value in series.items()
    ]


def _signal_records(weights: pd.DataFrame) -> list[dict[str, Any]]:
    changes = weights.diff().fillna(weights)
    records: list[dict[str, Any]] = []
    for timestamp, row in changes.iterrows():
        for symbol, change in row.items():
            if abs(float(change)) <= 1e-10:
                continue
            records.append(
                {
                    "time": timestamp.date().isoformat(),
                    "symbol": symbol,
                    "side": "BUY" if change > 0 else "SELL",
                    "targetWeight": _finite(weights.at[timestamp, symbol]),
                }
            )
    return records


def _metric_values(run: ResearchRun) -> dict[str, float | int | None]:
    metrics = run.metrics
    return {
        "totalReturn": _finite(metrics.total_return),
        "annualizedReturn": _finite(metrics.annualized_return),
        "annualizedVolatility": _finite(metrics.annualized_volatility),
        "sharpeRatio": _finite(metrics.sharpe_ratio),
        "maximumDrawdown": _finite(metrics.maximum_drawdown),
        "winRate": _finite(metrics.win_rate),
        "finalValue": _finite(run.result.final_value),
        "tradeCount": len(run.result.trades),
    }


def _finite(value: Any) -> float | None:
    numeric = float(value)
    return numeric if isfinite(numeric) else None
