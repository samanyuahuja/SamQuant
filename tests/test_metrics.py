"""Tests for Phase 5 performance and risk analytics."""

from __future__ import annotations

from math import isnan, sqrt

import numpy as np
import pandas as pd
import pytest

from samquant.analytics import (
    AnalyticsError,
    annualized_return,
    annualized_volatility,
    calculate_metrics,
    maximum_drawdown,
    sharpe_ratio,
    total_return,
    trade_win_rate,
)
from samquant.engine.backtester import BacktestResult
from samquant.engine.order import Order, OrderSide, Trade


def _equity(values: list[float]) -> pd.Series:
    return pd.Series(
        values,
        index=pd.date_range("2024-01-02", periods=len(values), freq="D"),
        name="Equity",
        dtype=float,
    )


def _equity_from_returns(returns: pd.Series) -> pd.Series:
    values = [100.0]
    for period_return in returns:
        values.append(values[-1] * (1.0 + period_return))
    return _equity(values)


def _trade(
    side: OrderSide,
    quantity: float,
    price: float,
    fee: float,
    day: int,
) -> Trade:
    return Trade(
        Order("AAPL", side, quantity),
        pd.Timestamp("2024-01-01") + pd.Timedelta(days=day),
        price,
        fee,
    )


def test_total_return_uses_compounded_start_to_finish_growth() -> None:
    assert total_return(_equity([100.0, 90.0, 120.0])) == pytest.approx(0.20)


def test_annualized_return_uses_observed_return_periods() -> None:
    values = 100.0 * np.power(2.0, np.arange(253) / 252)

    result = annualized_return(_equity(values.tolist()))

    assert result == pytest.approx(1.0)


def test_annualized_volatility_uses_sample_standard_deviation() -> None:
    returns = pd.Series([0.01, -0.02, 0.03])

    result = annualized_volatility(_equity_from_returns(returns))

    assert result == pytest.approx(returns.std(ddof=1) * sqrt(252))


def test_sharpe_ratio_annualizes_periodic_excess_returns() -> None:
    returns = pd.Series([0.01, -0.02, 0.03])

    result = sharpe_ratio(_equity_from_returns(returns))

    expected = returns.mean() / returns.std(ddof=1) * sqrt(252)
    assert result == pytest.approx(expected)


def test_sharpe_ratio_is_undefined_for_zero_volatility() -> None:
    assert isnan(sharpe_ratio(_equity([100.0, 101.0, 102.01])))


def test_maximum_drawdown_reports_positive_peak_to_trough_loss() -> None:
    result = maximum_drawdown(_equity([100.0, 120.0, 90.0, 100.0, 80.0, 130.0]))

    assert result == pytest.approx(1.0 - 80.0 / 120.0)


def test_trade_win_rate_uses_fifo_cost_basis_and_fees() -> None:
    trades = (
        _trade(OrderSide.BUY, 2.0, 100.0, 2.0, 1),
        _trade(OrderSide.SELL, 1.0, 120.0, 1.0, 2),
        _trade(OrderSide.SELL, 1.0, 90.0, 1.0, 3),
    )

    assert trade_win_rate(trades) == pytest.approx(0.5)


def test_trade_win_rate_ignores_unrealized_open_positions() -> None:
    trades = (_trade(OrderSide.BUY, 1.0, 100.0, 1.0, 1),)

    assert isnan(trade_win_rate(trades))


def test_trade_win_rate_rejects_sell_without_fifo_inventory() -> None:
    trades = (_trade(OrderSide.SELL, 1.0, 100.0, 0.0, 1),)

    with pytest.raises(AnalyticsError, match="exceeds tracked FIFO inventory"):
        trade_win_rate(trades)


def test_calculate_metrics_returns_one_immutable_summary() -> None:
    equity = _equity([100.0, 110.0, 105.0, 120.0])
    trades = (
        _trade(OrderSide.BUY, 1.0, 100.0, 0.0, 1),
        _trade(OrderSide.SELL, 1.0, 120.0, 0.0, 2),
    )
    result = BacktestResult(
        equity_curve=equity,
        cash_curve=equity.copy(),
        positions=pd.DataFrame({"AAPL": [0.0] * 4}, index=equity.index),
        trades=trades,
    )

    metrics = calculate_metrics(result)

    assert metrics.total_return == pytest.approx(0.20)
    assert metrics.maximum_drawdown == pytest.approx(1.0 - 105.0 / 110.0)
    assert metrics.win_rate == pytest.approx(1.0)


@pytest.mark.parametrize(
    "equity, message",
    [
        (pd.Series(dtype=float), "cannot be empty"),
        (_equity([100.0, 0.0]), "must be positive"),
        (_equity([100.0, float("nan")]), "must be finite"),
    ],
)
def test_metrics_reject_invalid_equity_curves(
    equity: pd.Series,
    message: str,
) -> None:
    with pytest.raises(AnalyticsError, match=message):
        total_return(equity)


def test_metrics_reject_invalid_annualization_and_risk_free_rate() -> None:
    equity = _equity([100.0, 101.0, 99.0])

    with pytest.raises(AnalyticsError, match="positive integer"):
        annualized_volatility(equity, periods_per_year=0)
    with pytest.raises(AnalyticsError, match="greater than -1"):
        sharpe_ratio(equity, risk_free_rate=-1.0)
