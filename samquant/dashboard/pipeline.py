"""Presentation helpers for the Streamlit dashboard."""

from __future__ import annotations

from collections.abc import Mapping
from math import isnan

import pandas as pd

from samquant.application import (
    DEFAULT_SYMBOLS,
    DEFAULT_SYMBOLS_BY_MARKET,
    EQUAL_WEIGHT_BENCHMARK,
    INDIA_BSE,
    INDIA_NSE,
    MARKET_NAMES,
    MARKET_SUFFIXES,
    MEAN_REVERSION,
    MOMENTUM,
    MOVING_AVERAGE,
    STRATEGY_NAMES,
    US_MARKET,
    BacktestConfig,
    ResearchError,
    ResearchRun,
    align_market_data,
    build_strategy,
    generate_demo_market_data,
    parse_symbols,
    run_backtest,
    run_strategy_comparison,
)
from samquant.engine import BacktestResult

# Backward-compatible names keep the existing Streamlit and public APIs stable.
DashboardConfig = BacktestConfig
DashboardError = ResearchError
DashboardRun = ResearchRun
run_dashboard_backtest = run_backtest

__all__ = [
    "DEFAULT_SYMBOLS",
    "DEFAULT_SYMBOLS_BY_MARKET",
    "EQUAL_WEIGHT_BENCHMARK",
    "INDIA_BSE",
    "INDIA_NSE",
    "MARKET_NAMES",
    "MARKET_SUFFIXES",
    "MEAN_REVERSION",
    "MOMENTUM",
    "MOVING_AVERAGE",
    "STRATEGY_NAMES",
    "US_MARKET",
    "DashboardConfig",
    "DashboardError",
    "DashboardRun",
    "align_market_data",
    "build_strategy",
    "comparison_metrics_frame",
    "drawdown_series",
    "format_number",
    "format_percentage",
    "generate_demo_market_data",
    "normalized_equity_frame",
    "parse_symbols",
    "run_dashboard_backtest",
    "run_strategy_comparison",
    "trades_frame",
]


def drawdown_series(equity_curve: pd.Series) -> pd.Series:
    """Return percentage drawdown from each timestamp's previous equity peak."""
    running_peak = equity_curve.cummax()
    return (equity_curve / running_peak - 1.0).rename("Drawdown")


def normalized_equity_frame(
    runs: Mapping[str, ResearchRun],
) -> pd.DataFrame:
    """Return each run rebased to 100 for an apples-to-apples chart."""
    normalized = {
        name: run.result.equity_curve / run.result.equity_curve.iloc[0] * 100.0
        for name, run in runs.items()
    }
    return pd.DataFrame(normalized)


def comparison_metrics_frame(
    runs: Mapping[str, ResearchRun],
) -> pd.DataFrame:
    """Return a compact percentage-friendly strategy comparison table."""
    rows = []
    for name, run in runs.items():
        metrics = run.metrics
        rows.append(
            {
                "Strategy": name,
                "Total return": metrics.total_return,
                "Annualized return": metrics.annualized_return,
                "Volatility": metrics.annualized_volatility,
                "Sharpe ratio": metrics.sharpe_ratio,
                "Maximum drawdown": metrics.maximum_drawdown,
                "Win rate": metrics.win_rate,
                "Trades": len(run.result.trades),
            }
        )
    return pd.DataFrame(rows).set_index("Strategy")


def trades_frame(result: BacktestResult) -> pd.DataFrame:
    """Convert immutable trade records into a dashboard-ready table."""
    rows = [
        {
            "Date": trade.timestamp,
            "Symbol": trade.order.symbol,
            "Side": trade.order.side.value,
            "Quantity": trade.order.quantity,
            "Price": trade.price,
            "Notional": trade.notional,
            "Fee": trade.fee,
            "Cash effect": trade.cash_effect,
        }
        for trade in result.trades
    ]
    columns = [
        "Date",
        "Symbol",
        "Side",
        "Quantity",
        "Price",
        "Notional",
        "Fee",
        "Cash effect",
    ]
    return pd.DataFrame(rows, columns=columns)


def format_percentage(value: float) -> str:
    """Format a ratio without turning undefined values into zero."""
    return "N/A" if isnan(value) else f"{value:.1%}"


def format_number(value: float, digits: int = 2) -> str:
    """Format a number without hiding undefined values."""
    return "N/A" if isnan(value) else f"{value:.{digits}f}"
