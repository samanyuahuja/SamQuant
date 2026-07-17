"""Portfolio accounting for cash, positions, fees, and valuation."""

from __future__ import annotations

from math import isfinite
from numbers import Real
from typing import Mapping

import pandas as pd

from samquant.engine.order import Order, OrderSide, Trade

_FLOAT_TOLERANCE = 1e-10


class PortfolioError(ValueError):
    """Base exception for invalid portfolio operations."""


class InsufficientCashError(PortfolioError):
    """Raised when a buy order costs more cash than the portfolio holds."""


class InsufficientPositionError(PortfolioError):
    """Raised when a sell order exceeds the current long position."""


class Portfolio:
    """Own cash, long positions, transaction costs, and executed trades."""

    def __init__(
        self,
        initial_cash: float,
        commission_rate: float = 0.0,
        fixed_fee: float = 0.0,
    ) -> None:
        self._validate_positive_amount(initial_cash, "Initial cash")
        self._validate_non_negative_amount(commission_rate, "Commission rate")
        self._validate_non_negative_amount(fixed_fee, "Fixed fee")

        self._initial_cash = float(initial_cash)
        self._cash = float(initial_cash)
        self._commission_rate = float(commission_rate)
        self._fixed_fee = float(fixed_fee)
        self._positions: dict[str, float] = {}
        self._trades: list[Trade] = []

    @property
    def initial_cash(self) -> float:
        """Return the cash supplied when the portfolio was created."""
        return self._initial_cash

    @property
    def cash(self) -> float:
        """Return currently available cash."""
        return self._cash

    @property
    def commission_rate(self) -> float:
        """Return the proportional fee charged on each trade's notional."""
        return self._commission_rate

    @property
    def fixed_fee(self) -> float:
        """Return the flat fee charged on each executed trade."""
        return self._fixed_fee

    @property
    def positions(self) -> dict[str, float]:
        """Return a copy of current quantities keyed by normalized symbol."""
        return self._positions.copy()

    @property
    def trades(self) -> tuple[Trade, ...]:
        """Return executed trades as an immutable tuple."""
        return tuple(self._trades)

    def calculate_fee(self, notional: float) -> float:
        """Calculate the commission and fixed fee for a trade value."""
        self._validate_positive_amount(notional, "Trade notional")
        return notional * self._commission_rate + self._fixed_fee

    def execute(self, order: Order, price: float, timestamp: pd.Timestamp) -> Trade:
        """Fill an order completely and update portfolio accounting atomically."""
        self._validate_positive_amount(price, "Execution price")
        normalized_timestamp = pd.Timestamp(timestamp)
        if pd.isna(normalized_timestamp):
            raise PortfolioError("Execution timestamp must be valid.")

        execution_price = float(price)
        notional = order.quantity * execution_price
        fee = self.calculate_fee(notional)

        if order.side is OrderSide.BUY:
            self._execute_buy(order, notional, fee)
        else:
            self._execute_sell(order, notional, fee)

        trade = Trade(
            order=order,
            timestamp=normalized_timestamp,
            price=execution_price,
            fee=fee,
        )
        self._trades.append(trade)
        return trade

    def market_value(self, prices: Mapping[str, float]) -> float:
        """Return the current value of all positions at supplied market prices."""
        normalized_prices = {symbol.strip().upper(): price for symbol, price in prices.items()}
        missing_symbols = sorted(set(self._positions).difference(normalized_prices))
        if missing_symbols:
            raise PortfolioError(f"Missing prices for held symbols: {missing_symbols}.")

        value = 0.0
        for symbol, quantity in self._positions.items():
            price = normalized_prices[symbol]
            self._validate_positive_amount(price, f"Price for {symbol}")
            value += quantity * float(price)
        return value

    def total_value(self, prices: Mapping[str, float]) -> float:
        """Return cash plus the marked-to-market value of all positions."""
        return self._cash + self.market_value(prices)

    def _execute_buy(self, order: Order, notional: float, fee: float) -> None:
        total_cost = notional + fee
        if total_cost > self._cash + _FLOAT_TOLERANCE:
            raise InsufficientCashError(
                f"Buy requires {total_cost:.2f}, but only {self._cash:.2f} is available."
            )

        self._cash -= total_cost
        if abs(self._cash) <= _FLOAT_TOLERANCE:
            self._cash = 0.0
        self._positions[order.symbol] = self._positions.get(order.symbol, 0.0) + order.quantity

    def _execute_sell(self, order: Order, notional: float, fee: float) -> None:
        held_quantity = self._positions.get(order.symbol, 0.0)
        if order.quantity > held_quantity + _FLOAT_TOLERANCE:
            raise InsufficientPositionError(
                f"Cannot sell {order.quantity:g} {order.symbol}; only {held_quantity:g} is held."
            )

        remaining_quantity = held_quantity - order.quantity
        if remaining_quantity <= _FLOAT_TOLERANCE:
            self._positions.pop(order.symbol, None)
        else:
            self._positions[order.symbol] = remaining_quantity
        self._cash += notional - fee

    @staticmethod
    def _validate_positive_amount(value: float, label: str) -> None:
        if isinstance(value, bool) or not isinstance(value, Real):
            raise PortfolioError(f"{label} must be numeric.")
        if not isfinite(value) or value <= 0:
            raise PortfolioError(f"{label} must be finite and positive.")

    @staticmethod
    def _validate_non_negative_amount(value: float, label: str) -> None:
        if isinstance(value, bool) or not isinstance(value, Real):
            raise PortfolioError(f"{label} must be numeric.")
        if not isfinite(value) or value < 0:
            raise PortfolioError(f"{label} must be finite and non-negative.")
