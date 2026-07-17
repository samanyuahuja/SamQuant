"""Validated order and trade models for simulated execution."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from math import isfinite
from numbers import Real

import pandas as pd


class OrderValidationError(ValueError):
    """Raised when an order or executed trade contains invalid values."""


class OrderSide(str, Enum):
    """Supported directions for a long-only trading order."""

    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class Order:
    """A request to buy or sell a positive quantity of one asset."""

    symbol: str
    side: OrderSide
    quantity: float

    def __post_init__(self) -> None:
        if not isinstance(self.symbol, str):
            raise OrderValidationError("Order symbol must be a string.")
        normalized_symbol = self.symbol.strip().upper()
        if not normalized_symbol:
            raise OrderValidationError("Order symbol cannot be empty.")
        if not isinstance(self.side, OrderSide):
            raise OrderValidationError("Order side must be an OrderSide value.")
        if isinstance(self.quantity, bool) or not isinstance(self.quantity, Real):
            raise OrderValidationError("Order quantity must be numeric.")
        if not isfinite(self.quantity) or self.quantity <= 0:
            raise OrderValidationError("Order quantity must be finite and positive.")

        object.__setattr__(self, "symbol", normalized_symbol)
        object.__setattr__(self, "quantity", float(self.quantity))


@dataclass(frozen=True)
class Trade:
    """An immutable record of an order filled by the simulated portfolio."""

    order: Order
    timestamp: pd.Timestamp
    price: float
    fee: float

    def __post_init__(self) -> None:
        if not isinstance(self.timestamp, pd.Timestamp) or pd.isna(self.timestamp):
            raise OrderValidationError("Trade timestamp must be a valid pandas Timestamp.")
        if isinstance(self.price, bool) or not isinstance(self.price, Real):
            raise OrderValidationError("Trade price must be numeric.")
        if not isfinite(self.price) or self.price <= 0:
            raise OrderValidationError("Trade price must be finite and positive.")
        if isinstance(self.fee, bool) or not isinstance(self.fee, Real):
            raise OrderValidationError("Trade fee must be numeric.")
        if not isfinite(self.fee) or self.fee < 0:
            raise OrderValidationError("Trade fee must be finite and non-negative.")

    @property
    def notional(self) -> float:
        """Return the value of the shares before transaction fees."""
        return self.order.quantity * self.price

    @property
    def cash_effect(self) -> float:
        """Return the signed change this trade makes to portfolio cash."""
        if self.order.side is OrderSide.BUY:
            return -(self.notional + self.fee)
        return self.notional - self.fee
