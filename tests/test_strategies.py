"""Tests for Phase 4 target-weight strategy implementations."""

from __future__ import annotations

from typing import Callable

import pandas as pd
import pytest

from samquant.engine import Backtester
from samquant.strategies import (
    MeanReversionStrategy,
    MomentumStrategy,
    MovingAverageCrossoverStrategy,
    StrategyError,
)


def _ohlcv(closes: list[float]) -> pd.DataFrame:
    dates = pd.date_range("2024-01-02", periods=len(closes), freq="D", name="Date")
    return pd.DataFrame(
        {
            "Open": closes,
            "High": [price + 1.0 for price in closes],
            "Low": [price - 1.0 for price in closes],
            "Close": closes,
            "Volume": [1_000_000] * len(closes),
        },
        index=dates,
    )


def test_moving_average_waits_for_history_and_enters_uptrend() -> None:
    data = _ohlcv([10.0, 10.0, 10.0, 12.0, 14.0, 16.0])

    weights = MovingAverageCrossoverStrategy(
        short_window=2,
        long_window=3,
    ).generate_target_weights({" aapl ": data})

    assert weights.columns.tolist() == ["AAPL"]
    assert weights["AAPL"].tolist() == [0.0, 0.0, 0.0, 1.0, 1.0, 1.0]


def test_moving_average_equal_weights_multiple_active_assets() -> None:
    first = _ohlcv([10.0, 10.0, 11.0, 12.0])
    second = _ohlcv([20.0, 20.0, 22.0, 24.0])

    weights = MovingAverageCrossoverStrategy(1, 2).generate_target_weights(
        {"AAPL": first, "MSFT": second}
    )

    assert weights.iloc[-1].to_dict() == {"AAPL": 0.5, "MSFT": 0.5}
    assert (weights.sum(axis=1) <= 1.0).all()


def test_moving_average_past_weights_ignore_future_price_changes() -> None:
    original = _ohlcv([10.0, 11.0, 12.0, 13.0, 14.0])
    changed_future = _ohlcv([10.0, 11.0, 12.0, 13.0, 1_000.0])
    strategy = MovingAverageCrossoverStrategy(2, 3)

    original_weights = strategy.generate_target_weights({"AAPL": original})
    changed_weights = strategy.generate_target_weights({"AAPL": changed_future})

    pd.testing.assert_series_equal(
        original_weights.iloc[:-1, 0],
        changed_weights.iloc[:-1, 0],
    )


def test_mean_reversion_enters_on_drop_and_exits_at_mean() -> None:
    data = _ohlcv([10.0, 10.0, 10.0, 8.0, 9.0, 10.0])
    strategy = MeanReversionStrategy(
        lookback_window=3,
        entry_z_score=-1.0,
        exit_z_score=0.0,
    )

    weights = strategy.generate_target_weights({"AAPL": data})

    assert weights["AAPL"].tolist() == [0.0, 0.0, 0.0, 1.0, 0.0, 0.0]


def test_mean_reversion_handles_zero_volatility_without_false_signal() -> None:
    data = _ohlcv([10.0] * 6)

    weights = MeanReversionStrategy(lookback_window=3).generate_target_weights(
        {"AAPL": data}
    )

    assert (weights == 0.0).all().all()


def test_momentum_ranks_assets_and_holds_until_next_rebalance() -> None:
    aapl = _ohlcv([100.0, 110.0, 121.0, 120.0, 119.0])
    msft = _ohlcv([100.0, 100.0, 100.0, 110.0, 121.0])
    strategy = MomentumStrategy(
        lookback_window=2,
        top_n=1,
        rebalance_frequency=2,
    )

    weights = strategy.generate_target_weights({"AAPL": aapl, "MSFT": msft})

    assert weights.to_dict("records") == [
        {"AAPL": 0.0, "MSFT": 0.0},
        {"AAPL": 0.0, "MSFT": 0.0},
        {"AAPL": 1.0, "MSFT": 0.0},
        {"AAPL": 1.0, "MSFT": 0.0},
        {"AAPL": 0.0, "MSFT": 1.0},
    ]


def test_momentum_holds_cash_when_all_returns_are_negative() -> None:
    aapl = _ohlcv([100.0, 90.0, 80.0])
    msft = _ohlcv([100.0, 95.0, 90.0])

    weights = MomentumStrategy(
        lookback_window=1,
        rebalance_frequency=1,
    ).generate_target_weights({"AAPL": aapl, "MSFT": msft})

    assert (weights == 0.0).all().all()


def test_strategy_weights_integrate_with_delayed_backtester_execution() -> None:
    data = _ohlcv([10.0, 10.0, 10.0, 12.0, 14.0, 16.0])
    weights = MovingAverageCrossoverStrategy(2, 3).generate_target_weights(
        {"AAPL": data}
    )

    result = Backtester(initial_cash=1_000.0, commission_rate=0.0).run(
        {"AAPL": data},
        weights,
    )

    assert len(result.trades) == 1
    assert result.trades[0].timestamp == data.index[4]
    assert result.trades[0].price == 14.0


@pytest.mark.parametrize(
    "factory, message",
    [
        (
            lambda: MovingAverageCrossoverStrategy(short_window=5, long_window=5),
            "smaller than long window",
        ),
        (lambda: MeanReversionStrategy(lookback_window=1), "at least 2"),
        (lambda: MomentumStrategy(top_n=0), "positive integer"),
    ],
)
def test_strategies_reject_invalid_configuration(
    factory: Callable[[], object],
    message: str,
) -> None:
    with pytest.raises(StrategyError, match=message):
        factory()


def test_strategy_rejects_misaligned_market_data() -> None:
    aapl = _ohlcv([100.0, 101.0, 102.0])
    msft = _ohlcv([200.0, 201.0, 202.0]).iloc[1:]

    with pytest.raises(StrategyError, match="same timestamps"):
        MomentumStrategy(lookback_window=1).generate_target_weights(
            {"AAPL": aapl, "MSFT": msft}
        )
