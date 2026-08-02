"""Validated performance and risk metrics for historical backtests."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from math import isfinite, sqrt
from numbers import Integral, Real
from typing import Sequence

import numpy as np
import pandas as pd

from samquant.engine.backtester import BacktestResult
from samquant.engine.order import OrderSide, Trade

_ZERO_TOLERANCE = 1e-12


class AnalyticsError(ValueError):
    """Raised when performance inputs or metric settings are invalid."""


@dataclass(frozen=True)
class PerformanceMetrics:
    """Summary statistics calculated from one historical backtest."""

    total_return: float
    annualized_return: float
    annualized_volatility: float
    sharpe_ratio: float
    maximum_drawdown: float
    win_rate: float


@dataclass
class _OpenLot:
    """Remaining quantity and fee-adjusted unit cost of one FIFO purchase."""

    quantity: float
    unit_cost: float


def total_return(equity_curve: pd.Series) -> float:
    """Return the compounded portfolio gain from the first to final value."""
    equity = _validated_equity_curve(equity_curve)
    return float(equity.iloc[-1] / equity.iloc[0] - 1.0)


def annualized_return(
    equity_curve: pd.Series,
    periods_per_year: int = 252,
) -> float:
    """Compound the observed portfolio return to a one-year equivalent."""
    equity = _validated_equity_curve(equity_curve)
    annualization = _validate_periods_per_year(periods_per_year)
    observed_periods = len(equity) - 1
    if observed_periods == 0:
        return float("nan")

    growth = float(equity.iloc[-1] / equity.iloc[0])
    return growth ** (annualization / observed_periods) - 1.0


def annualized_volatility(
    equity_curve: pd.Series,
    periods_per_year: int = 252,
) -> float:
    """Return sample standard deviation of periodic returns, annualized."""
    returns = _periodic_returns(equity_curve)
    annualization = _validate_periods_per_year(periods_per_year)
    if len(returns) < 2:
        return float("nan")

    return float(returns.std(ddof=1) * sqrt(annualization))


def sharpe_ratio(
    equity_curve: pd.Series,
    periods_per_year: int = 252,
    risk_free_rate: float = 0.0,
) -> float:
    """Return annualized Sharpe ratio using simple periodic portfolio returns."""
    returns = _periodic_returns(equity_curve)
    annualization = _validate_periods_per_year(periods_per_year)
    annual_risk_free_rate = _validate_risk_free_rate(risk_free_rate)
    if len(returns) < 2:
        return float("nan")

    volatility = float(returns.std(ddof=1))
    if volatility <= _ZERO_TOLERANCE:
        return float("nan")

    periodic_risk_free_rate = (
        (1.0 + annual_risk_free_rate) ** (1.0 / annualization) - 1.0
    )
    excess_return = float(returns.mean()) - periodic_risk_free_rate
    return excess_return / volatility * sqrt(annualization)


def maximum_drawdown(equity_curve: pd.Series) -> float:
    """Return the largest peak-to-trough loss as a positive proportion."""
    equity = _validated_equity_curve(equity_curve)
    running_peak = equity.cummax()
    drawdowns = equity / running_peak - 1.0
    return float(-drawdowns.min())


def trade_win_rate(trades: Sequence[Trade]) -> float:
    """Return profitable sell executions divided by completed sell executions.

    Purchases are matched to sales using FIFO cost basis. Buy fees increase cost
    basis, sell fees reduce proceeds, and positions still open at the end are
    excluded because their profit or loss has not been realized.
    """
    open_lots: dict[str, deque[_OpenLot]] = {}
    previous_timestamp: pd.Timestamp | None = None
    completed_sales = 0
    profitable_sales = 0

    for trade in trades:
        if not isinstance(trade, Trade):
            raise AnalyticsError("Win-rate inputs must contain Trade objects.")
        if previous_timestamp is not None and trade.timestamp < previous_timestamp:
            raise AnalyticsError("Trades must be ordered by timestamp.")
        previous_timestamp = trade.timestamp

        symbol_lots = open_lots.setdefault(trade.order.symbol, deque())
        if trade.order.side is OrderSide.BUY:
            unit_cost = (trade.notional + trade.fee) / trade.order.quantity
            symbol_lots.append(_OpenLot(trade.order.quantity, unit_cost))
            continue

        remaining_quantity = trade.order.quantity
        cost_basis = 0.0
        while remaining_quantity > _ZERO_TOLERANCE and symbol_lots:
            lot = symbol_lots[0]
            matched_quantity = min(remaining_quantity, lot.quantity)
            cost_basis += matched_quantity * lot.unit_cost
            lot.quantity -= matched_quantity
            remaining_quantity -= matched_quantity
            if lot.quantity <= _ZERO_TOLERANCE:
                symbol_lots.popleft()

        if remaining_quantity > _ZERO_TOLERANCE:
            raise AnalyticsError(
                f"Sell trade exceeds tracked FIFO inventory for {trade.order.symbol}."
            )

        net_proceeds = trade.notional - trade.fee
        completed_sales += 1
        if net_proceeds - cost_basis > _ZERO_TOLERANCE:
            profitable_sales += 1

    if completed_sales == 0:
        return float("nan")
    return profitable_sales / completed_sales


def calculate_metrics(
    result: BacktestResult,
    periods_per_year: int = 252,
    risk_free_rate: float = 0.0,
) -> PerformanceMetrics:
    """Calculate the standard performance summary for a backtest result."""
    if not isinstance(result, BacktestResult):
        raise AnalyticsError("Result must be a BacktestResult.")

    return PerformanceMetrics(
        total_return=total_return(result.equity_curve),
        annualized_return=annualized_return(
            result.equity_curve,
            periods_per_year,
        ),
        annualized_volatility=annualized_volatility(
            result.equity_curve,
            periods_per_year,
        ),
        sharpe_ratio=sharpe_ratio(
            result.equity_curve,
            periods_per_year,
            risk_free_rate,
        ),
        maximum_drawdown=maximum_drawdown(result.equity_curve),
        win_rate=trade_win_rate(result.trades),
    )


def _validated_equity_curve(equity_curve: pd.Series) -> pd.Series:
    if not isinstance(equity_curve, pd.Series):
        raise AnalyticsError("Equity curve must be a pandas Series.")
    if equity_curve.empty:
        raise AnalyticsError("Equity curve cannot be empty.")
    if not equity_curve.index.is_monotonic_increasing:
        raise AnalyticsError("Equity curve index must be sorted.")
    if not equity_curve.index.is_unique:
        raise AnalyticsError("Equity curve index cannot contain duplicates.")
    if not pd.api.types.is_numeric_dtype(equity_curve):
        raise AnalyticsError("Equity curve values must be numeric.")

    equity = equity_curve.astype(float)
    values = equity.to_numpy(dtype=float)
    if not np.isfinite(values).all():
        raise AnalyticsError("Equity curve values must be finite.")
    if (values <= 0.0).any():
        raise AnalyticsError("Equity curve values must be positive.")
    return equity


def _periodic_returns(equity_curve: pd.Series) -> pd.Series:
    equity = _validated_equity_curve(equity_curve)
    return equity.pct_change(fill_method=None).dropna()


def _validate_periods_per_year(periods_per_year: int) -> int:
    if (
        isinstance(periods_per_year, bool)
        or not isinstance(periods_per_year, Integral)
        or periods_per_year <= 0
    ):
        raise AnalyticsError("Periods per year must be a positive integer.")
    return int(periods_per_year)


def _validate_risk_free_rate(risk_free_rate: float) -> float:
    if isinstance(risk_free_rate, bool) or not isinstance(risk_free_rate, Real):
        raise AnalyticsError("Risk-free rate must be numeric.")
    if not isfinite(risk_free_rate) or risk_free_rate <= -1.0:
        raise AnalyticsError("Risk-free rate must be finite and greater than -1.")
    return float(risk_free_rate)
