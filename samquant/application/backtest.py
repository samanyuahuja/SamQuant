"""Use cases that connect market data, strategies, execution, and analytics."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
import pandas as pd

from samquant.analytics import PerformanceMetrics, calculate_metrics
from samquant.data.market_data import get_ohlcv, normalize_symbol, validate_ohlcv
from samquant.engine import Backtester, BacktestResult
from samquant.strategies import (
    MeanReversionStrategy,
    MomentumStrategy,
    MovingAverageCrossoverStrategy,
    StrategyEvaluation,
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
MARKET_SUFFIXES = {US_MARKET: "", INDIA_NSE: ".NS", INDIA_BSE: ".BO"}
DEFAULT_SYMBOLS_BY_MARKET = {
    US_MARKET: ("AAPL", "MSFT", "NVDA"),
    INDIA_NSE: ("RELIANCE", "TCS", "INFY"),
    INDIA_BSE: ("RELIANCE", "TCS", "INFY"),
}
DEFAULT_SYMBOLS = DEFAULT_SYMBOLS_BY_MARKET[US_MARKET]

MAX_SYMBOLS = 6
MAX_PERIODS = 2_000


class ResearchError(ValueError):
    """Raised when an application request cannot produce a valid backtest."""


class EvaluatedStrategy(Protocol):
    """Strategy behavior required by the research application service."""

    def evaluate(
        self,
        market_data: Mapping[str, pd.DataFrame],
    ) -> StrategyEvaluation:
        """Return causal indicators and target portfolio weights."""


@dataclass(frozen=True)
class BacktestConfig:
    """Execution and analytics settings for one backtest."""

    initial_cash: float = 100_000.0
    commission_rate: float = 0.001
    fixed_fee: float = 0.0
    slippage_bps: float = 5.0
    periods_per_year: int = 252
    risk_free_rate: float = 0.0


@dataclass(frozen=True)
class ResearchRun:
    """One strategy evaluation, simulated result, and metric summary."""

    strategy_name: str
    evaluation: StrategyEvaluation
    result: BacktestResult
    metrics: PerformanceMetrics

    @property
    def target_weights(self) -> pd.DataFrame:
        """Keep the existing dashboard-facing target-weight API stable."""
        return self.evaluation.target_weights


def parse_symbols(
    raw_symbols: str,
    market_name: str = US_MARKET,
) -> tuple[str, ...]:
    """Normalize comma-separated tickers and apply the selected market suffix."""
    if not isinstance(raw_symbols, str):
        raise ResearchError("Symbols must be entered as text.")
    if market_name not in MARKET_SUFFIXES:
        raise ResearchError(f"Unsupported market: {market_name}.")

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
        raise ResearchError("Enter at least one ticker symbol.")
    if len(symbols) > MAX_SYMBOLS:
        raise ResearchError(f"Enter no more than {MAX_SYMBOLS} ticker symbols.")
    return tuple(symbols)


def generate_demo_market_data(
    symbols: tuple[str, ...] = DEFAULT_SYMBOLS,
    periods: int = 520,
    start: str = "2022-01-03",
) -> dict[str, pd.DataFrame]:
    """Create deterministic OHLCV bars for an offline research demonstration."""
    if not 2 <= periods <= MAX_PERIODS:
        raise ResearchError(f"Demo data must contain 2 to {MAX_PERIODS} periods.")
    if not symbols:
        raise ResearchError("Demo data requires at least one symbol.")
    if len(symbols) > MAX_SYMBOLS:
        raise ResearchError(f"Demo data supports at most {MAX_SYMBOLS} symbols.")

    dates = pd.bdate_range(start, periods=periods, name="Date")
    market_data: dict[str, pd.DataFrame] = {}
    for position, raw_symbol in enumerate(symbols):
        symbol = normalize_symbol(raw_symbol)
        if symbol in market_data:
            raise ResearchError(f"Duplicate demo symbol: {symbol}.")

        generator = np.random.default_rng(2_026 + position)
        cycle = np.sin(np.linspace(0.0, 8.0 * np.pi, periods) + position)
        daily_returns = (
            0.00025
            + position * 0.00004
            + cycle * 0.0015
            + generator.normal(0.0, 0.011 + position * 0.001, periods)
        )
        close = (90.0 + position * 35.0) * np.exp(np.cumsum(daily_returns))
        open_price = close * (1.0 + generator.normal(0.0, 0.0025, periods))
        high = np.maximum(open_price, close) * (
            1.0 + generator.uniform(0.001, 0.009, periods)
        )
        low = np.minimum(open_price, close) * (
            1.0 - generator.uniform(0.001, 0.009, periods)
        )
        frame = pd.DataFrame(
            {
                "Open": open_price,
                "High": high,
                "Low": low,
                "Close": close,
                "Volume": generator.integers(800_000, 4_000_000, periods),
            },
            index=dates,
        )
        validate_ohlcv(frame)
        market_data[symbol] = frame

    return market_data


def align_market_data(
    market_data: Mapping[str, pd.DataFrame],
) -> dict[str, pd.DataFrame]:
    """Validate assets and align them to their shared timestamps."""
    if not market_data:
        raise ResearchError("Market data must contain at least one symbol.")

    normalized: dict[str, pd.DataFrame] = {}
    common_index: pd.DatetimeIndex | None = None
    for raw_symbol, frame in market_data.items():
        symbol = normalize_symbol(raw_symbol)
        if symbol in normalized:
            raise ResearchError(f"Duplicate market data symbol: {symbol}.")
        validate_ohlcv(frame)
        normalized[symbol] = frame.copy()
        common_index = (
            frame.index
            if common_index is None
            else common_index.intersection(frame.index, sort=False)
        )

    if common_index is None or len(common_index) < 2:
        raise ResearchError("Symbols need at least two shared timestamps.")
    if len(common_index) > MAX_PERIODS:
        raise ResearchError(f"Backtests support at most {MAX_PERIODS} shared periods.")
    return {
        symbol: frame.loc[common_index].copy()
        for symbol, frame in sorted(normalized.items())
    }


def load_market_data(
    *,
    source: str,
    symbols: tuple[str, ...],
    start: str,
    end: str,
    allow_yahoo: bool = False,
    data_dir: Path | str = "data/raw",
) -> dict[str, pd.DataFrame]:
    """Load deterministic demo bars or opt-in Yahoo Finance bars."""
    start_date = pd.Timestamp(start)
    end_date = pd.Timestamp(end)
    if pd.isna(start_date) or pd.isna(end_date) or end_date <= start_date:
        raise ResearchError("End date must be later than start date.")

    dates = pd.bdate_range(start_date, end_date, inclusive="left")
    if not 2 <= len(dates) <= MAX_PERIODS:
        raise ResearchError(
            f"Date range must contain 2 to {MAX_PERIODS} business days."
        )
    if source == "demo":
        return generate_demo_market_data(symbols, periods=len(dates), start=start)
    if source != "yahoo":
        raise ResearchError(f"Unsupported data source: {source}.")
    if not allow_yahoo:
        raise ResearchError(
            "Yahoo Finance access is disabled for this public research service."
        )

    downloaded = {
        symbol: get_ohlcv(symbol, start, end, data_dir=data_dir) for symbol in symbols
    }
    return align_market_data(downloaded)


def build_strategy(
    strategy_name: str,
    parameters: Mapping[str, int | float | bool] | None = None,
) -> EvaluatedStrategy:
    """Construct one supported strategy from interface-safe parameters."""
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
            require_positive_returns=bool(values.get("require_positive_returns", True)),
        )
    raise ResearchError(f"Unsupported strategy: {strategy_name}.")


def run_backtest(
    market_data: Mapping[str, pd.DataFrame],
    strategy_name: str,
    config: BacktestConfig,
    strategy_parameters: Mapping[str, int | float | bool] | None = None,
) -> ResearchRun:
    """Evaluate a strategy, execute delayed targets, and calculate metrics."""
    aligned_data = align_market_data(market_data)
    strategy = build_strategy(strategy_name, strategy_parameters)
    evaluation = strategy.evaluate(aligned_data)
    result = _run_engine(aligned_data, evaluation.target_weights, config)
    return ResearchRun(
        strategy_name=strategy_name,
        evaluation=evaluation,
        result=result,
        metrics=calculate_metrics(
            result,
            periods_per_year=config.periods_per_year,
            risk_free_rate=config.risk_free_rate,
        ),
    )


def run_equal_weight_benchmark(
    market_data: Mapping[str, pd.DataFrame],
    config: BacktestConfig,
) -> ResearchRun:
    """Run a delayed equal-weight buy-and-hold comparison."""
    aligned_data = align_market_data(market_data)
    index = next(iter(aligned_data.values())).index
    weights = pd.DataFrame(
        1.0 / len(aligned_data),
        index=index,
        columns=tuple(aligned_data),
        dtype=float,
    )
    evaluation = StrategyEvaluation(weights, indicators={})
    result = _run_engine(aligned_data, weights, config)
    return ResearchRun(
        strategy_name=EQUAL_WEIGHT_BENCHMARK,
        evaluation=evaluation,
        result=result,
        metrics=calculate_metrics(
            result,
            periods_per_year=config.periods_per_year,
            risk_free_rate=config.risk_free_rate,
        ),
    )


def run_strategy_comparison(
    market_data: Mapping[str, pd.DataFrame],
    config: BacktestConfig,
    primary_run: ResearchRun | None = None,
) -> dict[str, ResearchRun]:
    """Run all strategies and an equal-weight benchmark on the same bars."""
    aligned_data = align_market_data(market_data)
    runs = {primary_run.strategy_name: primary_run} if primary_run else {}
    for strategy_name in STRATEGY_NAMES:
        if strategy_name not in runs:
            runs[strategy_name] = run_backtest(aligned_data, strategy_name, config)
    runs[EQUAL_WEIGHT_BENCHMARK] = run_equal_weight_benchmark(aligned_data, config)
    return runs


def _run_engine(
    market_data: Mapping[str, pd.DataFrame],
    target_weights: pd.DataFrame,
    config: BacktestConfig,
) -> BacktestResult:
    return Backtester(
        initial_cash=config.initial_cash,
        commission_rate=config.commission_rate,
        fixed_fee=config.fixed_fee,
        slippage_bps=config.slippage_bps,
    ).run(market_data, target_weights)
