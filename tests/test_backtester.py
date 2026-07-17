"""Tests for delayed execution and historical backtest accounting."""

from __future__ import annotations

import pandas as pd
import pytest

from samquant.engine.backtester import BacktestError, Backtester
from samquant.engine.order import OrderSide


def _market_data(
    opens: list[float] | None = None,
    closes: list[float] | None = None,
) -> pd.DataFrame:
    open_values = opens or [100.0, 110.0, 120.0, 130.0]
    close_values = closes or [101.0, 111.0, 121.0, 131.0]
    dates = pd.date_range("2024-01-02", periods=4, freq="D", name="Date")
    return pd.DataFrame(
        {
            "Open": open_values,
            "High": [
                max(open_price, close_price) + 1
                for open_price, close_price in zip(open_values, close_values)
            ],
            "Low": [
                min(open_price, close_price) - 1
                for open_price, close_price in zip(open_values, close_values)
            ],
            "Close": close_values,
            "Volume": [1_000_000] * 4,
        },
        index=dates,
    )


def test_backtester_executes_targets_one_bar_later() -> None:
    prices = _market_data()
    targets = pd.DataFrame(
        {"AAPL": [1.0, 1.0, 0.0, 0.0]},
        index=prices.index,
    )

    result = Backtester(initial_cash=1_100.0, commission_rate=0.0).run(
        {"AAPL": prices},
        targets,
    )

    assert len(result.trades) == 2
    assert result.trades[0].order.side is OrderSide.BUY
    assert result.trades[0].timestamp == prices.index[1]
    assert result.trades[0].price == 110.0
    assert result.trades[1].order.side is OrderSide.SELL
    assert result.trades[1].timestamp == prices.index[3]
    assert result.equity_curve.tolist() == pytest.approx([1_100.0, 1_110.0, 1_210.0, 1_300.0])
    assert result.final_value == pytest.approx(1_300.0)


def test_unchanged_target_does_not_create_daily_rebalancing_trades() -> None:
    prices = _market_data()
    targets = pd.DataFrame({"AAPL": [0.5, 0.5, 0.5, 0.5]}, index=prices.index)

    result = Backtester(initial_cash=1_000.0, commission_rate=0.0).run(
        {"AAPL": prices},
        targets,
    )

    assert len(result.trades) == 1
    assert result.positions.iloc[1]["AAPL"] == pytest.approx(1_000.0 * 0.5 / 110.0)


def test_backtester_applies_slippage_and_caps_buy_to_available_cash() -> None:
    prices = _market_data(opens=[100.0] * 4, closes=[100.0] * 4)
    targets = pd.DataFrame({"AAPL": [1.0, 1.0, 1.0, 1.0]}, index=prices.index)

    result = Backtester(
        initial_cash=1_000.0,
        commission_rate=0.01,
        slippage_bps=100.0,
    ).run({"AAPL": prices}, targets)

    trade = result.trades[0]
    assert trade.price == pytest.approx(101.0)
    assert trade.order.quantity == pytest.approx(1_000.0 / (101.0 * 1.01))
    assert result.cash_curve.iloc[1] == pytest.approx(0.0, abs=1e-9)
    assert result.final_value < 1_000.0


def test_backtester_sells_before_buying_during_asset_rotation() -> None:
    aapl = _market_data(opens=[100.0] * 4, closes=[100.0] * 4)
    msft = _market_data(opens=[50.0] * 4, closes=[50.0] * 4)
    targets = pd.DataFrame(
        {
            "AAPL": [1.0, 0.0, 0.0, 0.0],
            "MSFT": [0.0, 1.0, 1.0, 1.0],
        },
        index=aapl.index,
    )

    result = Backtester(initial_cash=1_000.0, commission_rate=0.0).run(
        {"AAPL": aapl, "MSFT": msft},
        targets,
    )

    assert [trade.order.side for trade in result.trades] == [
        OrderSide.BUY,
        OrderSide.SELL,
        OrderSide.BUY,
    ]
    assert result.positions.iloc[-1].to_dict() == {"AAPL": 0.0, "MSFT": 20.0}


def test_backtester_rejects_misaligned_market_data() -> None:
    aapl = _market_data()
    msft = _market_data().iloc[1:]
    targets = pd.DataFrame(
        {"AAPL": [0.5] * 4, "MSFT": [0.5] * 4},
        index=aapl.index,
    )

    with pytest.raises(BacktestError, match="same timestamps"):
        Backtester().run({"AAPL": aapl, "MSFT": msft}, targets)


def test_backtester_rejects_invalid_long_only_weights() -> None:
    prices = _market_data()
    targets = pd.DataFrame({"AAPL": [1.1, 1.0, 1.0, 1.0]}, index=prices.index)

    with pytest.raises(BacktestError, match="sum to more than 1.0"):
        Backtester().run({"AAPL": prices}, targets)
