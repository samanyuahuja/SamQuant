"""Testable data preparation and orchestration for the Streamlit dashboard."""

from __future__ import annotations

from dataclasses import dataclass
from math import isnan
from typing import Mapping, Protocol

import numpy as np
import pandas as pd

from samquant.analytics import PerformanceMetrics, calculate_metrics
from samquant.data.market_data import normalize_symbol, validate_ohlcv
from samquant.engine import BacktestResult, Backtester
from samquant.strategies import (
    MeanReversionStrategy,
    MomentumStrategy,
    MovingAverageCrossoverStrategy,
)

MOVING_AVERAGE = "Moving average crossover"
MEAN_REVERSION = "Mean reversion"
MOMENTUM = "Momentum"
EQUAL_WEIGHT_BENCHMARK = "Equal-weight benchmark"
STRATEGY_NAMES = (MOVING_AVERAGE, MEAN_REVERSION, MOMENTUM)
US_MARKET = "US"
INDIA_NSE = "India (NSE)"
INDIA_BSE = "India (BSE)"
MARKET_NAMES = (US_MARKET, INDIA_NSE, INDIA_BSE)
MARKET_SUFFIXES = {
    US_MARKET: "",
    INDIA_NSE: ".NS",
    INDIA_BSE: ".BO",
}
DEFAULT_SYMBOLS_BY_MARKET = {
    US_MARKET: ("AAPL", "MSFT", "NVDA"),
    INDIA_NSE: ("RELIANCE", "TCS", "INFY"),
    INDIA_BSE: ("RELIANCE", "TCS", "INFY"),
}
DEFAULT_SYMBOLS = DEFAULT_SYMBOLS_BY_MARKET[US_MARKET]


class DashboardError(ValueError):
    """Raised when dashboard inputs cannot produce a valid backtest."""


class TargetWeightStrategy(Protocol):
    """Small strategy interface required by the dashboard pipeline."""

    def generate_target_weights(
        self,
        market_data: Mapping[str, pd.DataFrame],
    ) -> pd.DataFrame:
        """Return portfolio target weights indexed like the supplied data."""


@dataclass(frozen=True)
class DashboardConfig:
    """Execution and analytics settings shared by dashboard backtests."""

    initial_cash: float = 100_000.0
    commission_rate: float = 0.001
    fixed_fee: float = 0.0
    slippage_bps: float = 5.0
    periods_per_year: int = 252
    risk_free_rate: float = 0.0


@dataclass(frozen=True)
class DashboardRun:
    """One strategy's weights, simulated results, and calculated metrics."""

    strategy_name: str
    target_weights: pd.DataFrame
    result: BacktestResult
    metrics: PerformanceMetrics


def parse_symbols(
    raw_symbols: str,
    market_name: str = US_MARKET,
) -> tuple[str, ...]:
    """Parse symbols and add the Yahoo Finance suffix for the chosen market."""
    if not isinstance(raw_symbols, str):
        raise DashboardError("Symbols must be entered as text.")
    if market_name not in MARKET_SUFFIXES:
        raise DashboardError(f"Unsupported market: {market_name}.")

    symbols: list[str] = []
    for raw_symbol in raw_symbols.split(","):
        if not raw_symbol.strip():
            continue
        symbol = normalize_symbol(raw_symbol)
        suffix = MARKET_SUFFIXES[market_name]
        if suffix and "." not in symbol and not symbol.startswith("^"):
            symbol = f"{symbol}{suffix}"
        if symbol not in symbols:
            symbols.append(symbol)

    if not symbols:
        raise DashboardError("Enter at least one ticker symbol.")
    return tuple(symbols)


def generate_demo_market_data(
    symbols: tuple[str, ...] = DEFAULT_SYMBOLS,
    periods: int = 520,
    start: str = "2022-01-03",
) -> dict[str, pd.DataFrame]:
    """Create deterministic, valid OHLCV data for an offline dashboard demo."""
    if periods < 2:
        raise DashboardError("Demo data must contain at least two periods.")
    if not symbols:
        raise DashboardError("Demo data requires at least one symbol.")

    dates = pd.bdate_range(start, periods=periods, name="Date")
    market_data: dict[str, pd.DataFrame] = {}

    for position, raw_symbol in enumerate(symbols):
        symbol = normalize_symbol(raw_symbol)
        if symbol in market_data:
            raise DashboardError(f"Duplicate demo symbol: {symbol}.")

        generator = np.random.default_rng(2_026 + position)
        cycle = np.sin(np.linspace(0.0, 8.0 * np.pi, periods) + position)
        daily_returns = (
            0.00025
            + position * 0.00004
            + cycle * 0.0015
            + generator.normal(0.0, 0.011 + position * 0.001, periods)
        )
        close = (90.0 + position * 35.0) * np.exp(np.cumsum(daily_returns))
        overnight_move = generator.normal(0.0, 0.0025, periods)
        open_price = close * (1.0 + overnight_move)
        high = np.maximum(open_price, close) * (
            1.0 + generator.uniform(0.001, 0.009, periods)
        )
        low = np.minimum(open_price, close) * (
            1.0 - generator.uniform(0.001, 0.009, periods)
        )
        volume = generator.integers(800_000, 4_000_000, periods)

        frame = pd.DataFrame(
            {
                "Open": open_price,
                "High": high,
                "Low": low,
                "Close": close,
                "Volume": volume,
            },
            index=dates,
        )
        validate_ohlcv(frame)
        market_data[symbol] = frame

    return market_data


def align_market_data(
    market_data: Mapping[str, pd.DataFrame],
) -> dict[str, pd.DataFrame]:
    """Validate assets and align them to their shared historical timestamps."""
    if not market_data:
        raise DashboardError("Market data must contain at least one symbol.")

    normalized: dict[str, pd.DataFrame] = {}
    common_index: pd.DatetimeIndex | None = None
    for raw_symbol, frame in market_data.items():
        symbol = normalize_symbol(raw_symbol)
        if symbol in normalized:
            raise DashboardError(f"Duplicate market data symbol: {symbol}.")
        validate_ohlcv(frame)
        normalized[symbol] = frame.copy()
        common_index = (
            frame.index
            if common_index is None
            else common_index.intersection(frame.index, sort=False)
        )

    if common_index is None or len(common_index) < 2:
        raise DashboardError("Symbols need at least two shared timestamps.")

    return {
        symbol: frame.loc[common_index].copy()
        for symbol, frame in sorted(normalized.items())
    }


def build_strategy(
    strategy_name: str,
    parameters: Mapping[str, int | float | bool] | None = None,
) -> TargetWeightStrategy:
    """Create one supported strategy from dashboard-friendly parameters."""
    values = dict(parameters or {})
    if strategy_name == MOVING_AVERAGE:
        return MovingAverageCrossoverStrategy(
            short_window=int(values.get("short_window", 50)),
            long_window=int(values.get("long_window", 200)),
        )
    if strategy_name == MEAN_REVERSION:
        return MeanReversionStrategy(
            lookback_window=int(values.get("lookback_window", 20)),
            entry_z_score=float(values.get("entry_z_score", -2.0)),
            exit_z_score=float(values.get("exit_z_score", 0.0)),
        )
    if strategy_name == MOMENTUM:
        return MomentumStrategy(
            lookback_window=int(values.get("lookback_window", 126)),
            top_n=int(values.get("top_n", 1)),
            rebalance_frequency=int(values.get("rebalance_frequency", 21)),
            require_positive_returns=bool(
                values.get("require_positive_returns", True)
            ),
        )
    raise DashboardError(f"Unsupported strategy: {strategy_name}.")


def run_dashboard_backtest(
    market_data: Mapping[str, pd.DataFrame],
    strategy_name: str,
    config: DashboardConfig,
    strategy_parameters: Mapping[str, int | float | bool] | None = None,
) -> DashboardRun:
    """Generate signals, simulate next-open trades, and calculate metrics."""
    aligned_data = align_market_data(market_data)
    strategy = build_strategy(strategy_name, strategy_parameters)
    target_weights = strategy.generate_target_weights(aligned_data)
    result = Backtester(
        initial_cash=config.initial_cash,
        commission_rate=config.commission_rate,
        fixed_fee=config.fixed_fee,
        slippage_bps=config.slippage_bps,
    ).run(aligned_data, target_weights)
    metrics = calculate_metrics(
        result,
        periods_per_year=config.periods_per_year,
        risk_free_rate=config.risk_free_rate,
    )
    return DashboardRun(strategy_name, target_weights, result, metrics)


def run_strategy_comparison(
    market_data: Mapping[str, pd.DataFrame],
    config: DashboardConfig,
    primary_run: DashboardRun | None = None,
) -> dict[str, DashboardRun]:
    """Run the three strategies and an equal-weight historical benchmark."""
    aligned_data = align_market_data(market_data)
    runs: dict[str, DashboardRun] = {}

    if primary_run is not None:
        runs[primary_run.strategy_name] = primary_run

    for strategy_name in STRATEGY_NAMES:
        if strategy_name not in runs:
            runs[strategy_name] = run_dashboard_backtest(
                aligned_data,
                strategy_name,
                config,
            )

    benchmark_weights = pd.DataFrame(
        1.0 / len(aligned_data),
        index=next(iter(aligned_data.values())).index,
        columns=tuple(aligned_data),
        dtype=float,
    )
    benchmark_result = Backtester(
        initial_cash=config.initial_cash,
        commission_rate=config.commission_rate,
        fixed_fee=config.fixed_fee,
        slippage_bps=config.slippage_bps,
    ).run(aligned_data, benchmark_weights)
    runs[EQUAL_WEIGHT_BENCHMARK] = DashboardRun(
        strategy_name=EQUAL_WEIGHT_BENCHMARK,
        target_weights=benchmark_weights,
        result=benchmark_result,
        metrics=calculate_metrics(
            benchmark_result,
            periods_per_year=config.periods_per_year,
            risk_free_rate=config.risk_free_rate,
        ),
    )
    return runs


def drawdown_series(equity_curve: pd.Series) -> pd.Series:
    """Return percentage drawdown from each timestamp's previous equity peak."""
    running_peak = equity_curve.cummax()
    return (equity_curve / running_peak - 1.0).rename("Drawdown")


def normalized_equity_frame(
    runs: Mapping[str, DashboardRun],
) -> pd.DataFrame:
    """Return each run rebased to 100 for an apples-to-apples chart."""
    normalized = {
        name: run.result.equity_curve / run.result.equity_curve.iloc[0] * 100.0
        for name, run in runs.items()
    }
    return pd.DataFrame(normalized)


def comparison_metrics_frame(
    runs: Mapping[str, DashboardRun],
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
    """Format a ratio for display without turning undefined values into zero."""
    return "N/A" if isnan(value) else f"{value:.1%}"


def format_number(value: float, digits: int = 2) -> str:
    """Format a number for display without hiding undefined values."""
    return "N/A" if isnan(value) else f"{value:.{digits}f}"
