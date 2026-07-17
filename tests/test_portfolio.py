"""Tests for cash, position, fee, and valuation accounting."""

from __future__ import annotations

import pandas as pd
import pytest

from samquant.engine.order import Order, OrderSide
from samquant.engine.portfolio import (
    InsufficientCashError,
    InsufficientPositionError,
    Portfolio,
    PortfolioError,
)


def test_buy_and_sell_update_cash_positions_and_fees() -> None:
    portfolio = Portfolio(initial_cash=1_000.0, commission_rate=0.01, fixed_fee=1.0)
    timestamp = pd.Timestamp("2024-01-02")

    buy = portfolio.execute(Order("AAPL", OrderSide.BUY, 2), 100.0, timestamp)
    sell = portfolio.execute(Order("AAPL", OrderSide.SELL, 1), 110.0, timestamp)

    assert buy.fee == pytest.approx(3.0)
    assert sell.fee == pytest.approx(2.1)
    assert portfolio.cash == pytest.approx(904.9)
    assert portfolio.positions == {"AAPL": 1.0}
    assert portfolio.total_value({"AAPL": 120.0}) == pytest.approx(1_024.9)
    assert portfolio.trades == (buy, sell)


def test_buy_rejects_insufficient_cash_including_fees() -> None:
    portfolio = Portfolio(initial_cash=100.0, commission_rate=0.01)

    with pytest.raises(InsufficientCashError, match="only 100.00 is available"):
        portfolio.execute(
            Order("AAPL", OrderSide.BUY, 1),
            price=100.0,
            timestamp=pd.Timestamp("2024-01-02"),
        )


def test_sell_rejects_quantity_above_current_position() -> None:
    portfolio = Portfolio(initial_cash=1_000.0)

    with pytest.raises(InsufficientPositionError, match="only 0 is held"):
        portfolio.execute(
            Order("AAPL", OrderSide.SELL, 1),
            price=100.0,
            timestamp=pd.Timestamp("2024-01-02"),
        )


def test_positions_property_cannot_mutate_portfolio_state() -> None:
    portfolio = Portfolio(initial_cash=1_000.0)
    portfolio.execute(
        Order("AAPL", OrderSide.BUY, 1),
        price=100.0,
        timestamp=pd.Timestamp("2024-01-02"),
    )

    positions = portfolio.positions
    positions["AAPL"] = 999.0

    assert portfolio.positions == {"AAPL": 1.0}


def test_valuation_requires_a_valid_price_for_every_position() -> None:
    portfolio = Portfolio(initial_cash=1_000.0)
    portfolio.execute(
        Order("AAPL", OrderSide.BUY, 1),
        price=100.0,
        timestamp=pd.Timestamp("2024-01-02"),
    )

    with pytest.raises(PortfolioError, match="Missing prices"):
        portfolio.total_value({})

    with pytest.raises(PortfolioError, match="finite and positive"):
        portfolio.total_value({"AAPL": float("nan")})
