"""Tests for validated order and executed trade models."""

from __future__ import annotations

import pandas as pd
import pytest

from samquant.engine.order import Order, OrderSide, OrderValidationError, Trade


def test_order_normalizes_symbol_and_quantity() -> None:
    order = Order(" aapl ", OrderSide.BUY, 2)

    assert order.symbol == "AAPL"
    assert order.quantity == 2.0


@pytest.mark.parametrize("quantity", [0, -1, float("nan"), float("inf")])
def test_order_rejects_invalid_quantity(quantity: float) -> None:
    with pytest.raises(OrderValidationError, match="finite and positive"):
        Order("AAPL", OrderSide.BUY, quantity)


def test_order_rejects_untyped_side() -> None:
    with pytest.raises(OrderValidationError, match="OrderSide"):
        Order("AAPL", "BUY", 1)  # type: ignore[arg-type]


def test_trade_reports_notional_and_cash_effect() -> None:
    trade = Trade(
        order=Order("AAPL", OrderSide.BUY, 2),
        timestamp=pd.Timestamp("2024-01-02"),
        price=100.0,
        fee=1.5,
    )

    assert trade.notional == 200.0
    assert trade.cash_effect == -201.5
