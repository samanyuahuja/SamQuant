"""Historical backtesting orchestration with delayed signal execution."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from math import isfinite
from numbers import Real
from typing import Mapping

import numpy as np
import pandas as pd

from samquant.data.market_data import normalize_symbol, validate_ohlcv
from samquant.engine.order import Order, OrderSide, Trade
from samquant.engine.portfolio import Portfolio

_WEIGHT_TOLERANCE = 1e-10
_QUANTITY_TOLERANCE = 1e-10


class SizingMethod(str, Enum):
    """Supported conversions from active targets to order quantities."""

    PERCENTAGE = "percentage"
    FIXED_DOLLAR = "fixed_dollar"
    FIXED_SHARES = "fixed_shares"


class BacktestError(ValueError):
    """Raised when backtest inputs or configuration are invalid."""


@dataclass(frozen=True)
class BacktestResult:
    """Time series and trade records produced by one backtest run."""

    equity_curve: pd.Series
    cash_curve: pd.Series
    positions: pd.DataFrame
    trades: tuple[Trade, ...]

    @property
    def final_value(self) -> float:
        """Return the portfolio value recorded on the final bar."""
        return float(self.equity_curve.iloc[-1])


class Backtester:
    """Rebalance a long-only portfolio from delayed daily target weights."""

    def __init__(
        self,
        initial_cash: float = 100_000.0,
        commission_rate: float = 0.001,
        fixed_fee: float = 0.0,
        slippage_bps: float = 0.0,
        sizing_method: SizingMethod | str = SizingMethod.PERCENTAGE,
        position_size: float = 1.0,
        stop_loss: float | None = None,
        take_profit: float | None = None,
        max_position_allocation: float = 1.0,
        max_portfolio_exposure: float = 1.0,
    ) -> None:
        # Portfolio owns validation for shared cash and fee configuration.
        Portfolio(initial_cash, commission_rate, fixed_fee)
        if isinstance(slippage_bps, bool) or not isinstance(slippage_bps, Real):
            raise BacktestError("Slippage must be numeric basis points.")
        if not isfinite(slippage_bps) or not 0 <= slippage_bps < 10_000:
            raise BacktestError("Slippage must be finite and between 0 and 10,000 basis points.")

        try:
            normalized_sizing_method = SizingMethod(sizing_method)
        except ValueError as error:
            raise BacktestError(f"Unsupported sizing method: {sizing_method}.") from error
        self._validate_positive_number(position_size, "Position size")
        if normalized_sizing_method is SizingMethod.PERCENTAGE and position_size > 1.0:
            raise BacktestError("Percentage position size cannot exceed 1.0.")
        self._validate_optional_rate(stop_loss, "Stop loss")
        self._validate_optional_rate(take_profit, "Take profit")
        self._validate_allocation(max_position_allocation, "Maximum position allocation")
        self._validate_allocation(max_portfolio_exposure, "Maximum portfolio exposure")
        if max_position_allocation > max_portfolio_exposure:
            raise BacktestError(
                "Maximum position allocation cannot exceed portfolio exposure."
            )

        self._initial_cash = float(initial_cash)
        self._commission_rate = float(commission_rate)
        self._fixed_fee = float(fixed_fee)
        self._slippage_rate = float(slippage_bps) / 10_000
        self._sizing_method = normalized_sizing_method
        self._position_size = float(position_size)
        self._stop_loss = None if stop_loss is None else float(stop_loss)
        self._take_profit = None if take_profit is None else float(take_profit)
        self._max_position_allocation = float(max_position_allocation)
        self._max_portfolio_exposure = float(max_portfolio_exposure)

    def run(
        self,
        market_data: Mapping[str, pd.DataFrame],
        target_weights: pd.DataFrame,
    ) -> BacktestResult:
        """Run a backtest using prior-bar targets and current-bar opening prices.

        Each row in ``target_weights`` is a decision made after that row's market
        data is known. The engine shifts those decisions by one bar, so a target
        produced on Monday can first trade at Tuesday's open.
        """
        normalized_data = self._validate_market_data(market_data)
        symbols = tuple(sorted(normalized_data))
        dates = normalized_data[symbols[0]].index
        weights = self._validate_target_weights(target_weights, symbols, dates)
        execution_weights = weights.shift(1).fillna(0.0)

        portfolio = Portfolio(
            initial_cash=self._initial_cash,
            commission_rate=self._commission_rate,
            fixed_fee=self._fixed_fee,
        )
        equity_values: list[float] = []
        cash_values: list[float] = []
        position_rows: list[dict[str, float]] = []
        previous_target = pd.Series(0.0, index=symbols, dtype=float)
        entry_prices: dict[str, float] = {}
        tracked_quantities: dict[str, float] = {}

        for timestamp in dates:
            open_prices = {
                symbol: float(normalized_data[symbol].at[timestamp, "Open"])
                for symbol in symbols
            }
            current_target = execution_weights.loc[timestamp].copy()
            for symbol in self._risk_exit_symbols(portfolio, entry_prices, open_prices):
                current_target[symbol] = 0.0
            current_target = self._apply_weight_limits(current_target)
            if not np.allclose(
                current_target.to_numpy(dtype=float),
                previous_target.to_numpy(dtype=float),
                rtol=0.0,
                atol=_WEIGHT_TOLERANCE,
            ):
                trade_start = len(portfolio.trades)
                self._rebalance(portfolio, current_target, open_prices, timestamp)
                self._update_entry_prices(
                    portfolio.trades[trade_start:],
                    entry_prices,
                    tracked_quantities,
                )
                previous_target = current_target.copy()

            close_prices = {
                symbol: float(normalized_data[symbol].at[timestamp, "Close"])
                for symbol in symbols
            }
            current_positions = portfolio.positions
            equity_values.append(portfolio.total_value(close_prices))
            cash_values.append(portfolio.cash)
            position_rows.append(
                {symbol: current_positions.get(symbol, 0.0) for symbol in symbols}
            )

        equity_curve = pd.Series(equity_values, index=dates, name="Equity", dtype=float)
        cash_curve = pd.Series(cash_values, index=dates, name="Cash", dtype=float)
        positions = pd.DataFrame(position_rows, index=dates, columns=symbols, dtype=float)
        positions.index.name = dates.name

        return BacktestResult(
            equity_curve=equity_curve,
            cash_curve=cash_curve,
            positions=positions,
            trades=portfolio.trades,
        )

    def _rebalance(
        self,
        portfolio: Portfolio,
        target_weights: pd.Series,
        open_prices: Mapping[str, float],
        timestamp: pd.Timestamp,
    ) -> None:
        portfolio_value = portfolio.total_value(open_prices)
        current_positions = portfolio.positions
        desired_positions = self._desired_positions(
            target_weights,
            open_prices,
            portfolio_value,
        )
        quantity_changes = {
            symbol: desired_positions[symbol] - current_positions.get(symbol, 0.0)
            for symbol in target_weights.index
        }

        # Sales execute first so their proceeds can fund purchases in the same rebalance.
        for symbol in sorted(quantity_changes):
            quantity_change = quantity_changes[symbol]
            if quantity_change < -_QUANTITY_TOLERANCE:
                execution_price = open_prices[symbol] * (1 - self._slippage_rate)
                portfolio.execute(
                    Order(symbol, OrderSide.SELL, -quantity_change),
                    price=execution_price,
                    timestamp=timestamp,
                )

        for symbol in sorted(quantity_changes):
            quantity_change = quantity_changes[symbol]
            if quantity_change <= _QUANTITY_TOLERANCE:
                continue

            execution_price = open_prices[symbol] * (1 + self._slippage_rate)
            affordable_quantity = self._affordable_quantity(portfolio, execution_price)
            order_quantity = min(quantity_change, affordable_quantity)
            if order_quantity > _QUANTITY_TOLERANCE:
                portfolio.execute(
                    Order(symbol, OrderSide.BUY, order_quantity),
                    price=execution_price,
                    timestamp=timestamp,
                )

    def _desired_positions(
        self,
        target_weights: pd.Series,
        prices: Mapping[str, float],
        portfolio_value: float,
    ) -> dict[str, float]:
        desired_values: dict[str, float] = {}
        for symbol, raw_weight in target_weights.items():
            weight = float(raw_weight)
            if weight <= _WEIGHT_TOLERANCE:
                desired_values[symbol] = 0.0
            elif self._sizing_method is SizingMethod.FIXED_SHARES:
                desired_values[symbol] = self._position_size * prices[symbol]
            elif self._sizing_method is SizingMethod.FIXED_DOLLAR:
                desired_values[symbol] = self._position_size
            else:
                desired_values[symbol] = weight * self._position_size * portfolio_value

        position_cap = portfolio_value * self._max_position_allocation
        desired_values = {
            symbol: min(value, position_cap) for symbol, value in desired_values.items()
        }
        exposure_cap = portfolio_value * self._max_portfolio_exposure
        total_desired = sum(desired_values.values())
        if total_desired > exposure_cap + _WEIGHT_TOLERANCE:
            scale = exposure_cap / total_desired
            desired_values = {
                symbol: value * scale for symbol, value in desired_values.items()
            }
        return {
            symbol: desired_values[symbol] / prices[symbol]
            for symbol in target_weights.index
        }

    def _apply_weight_limits(self, target_weights: pd.Series) -> pd.Series:
        limited = target_weights.clip(upper=self._max_position_allocation)
        total = float(limited.sum())
        if total > self._max_portfolio_exposure + _WEIGHT_TOLERANCE:
            limited *= self._max_portfolio_exposure / total
        return limited

    def _risk_exit_symbols(
        self,
        portfolio: Portfolio,
        entry_prices: Mapping[str, float],
        open_prices: Mapping[str, float],
    ) -> tuple[str, ...]:
        exits: list[str] = []
        for symbol in portfolio.positions:
            entry_price = entry_prices.get(symbol)
            if entry_price is None:
                continue
            return_since_entry = open_prices[symbol] / entry_price - 1.0
            stop_hit = (
                self._stop_loss is not None
                and return_since_entry <= -self._stop_loss
            )
            target_hit = (
                self._take_profit is not None
                and return_since_entry >= self._take_profit
            )
            if stop_hit or target_hit:
                exits.append(symbol)
        return tuple(exits)

    @staticmethod
    def _update_entry_prices(
        trades: tuple[Trade, ...],
        entry_prices: dict[str, float],
        tracked_quantities: dict[str, float],
    ) -> None:
        for trade in trades:
            symbol = trade.order.symbol
            previous_quantity = tracked_quantities.get(symbol, 0.0)
            if trade.order.side is OrderSide.BUY:
                next_quantity = previous_quantity + trade.order.quantity
                previous_cost = entry_prices.get(symbol, trade.price) * previous_quantity
                entry_prices[symbol] = (
                    previous_cost + trade.price * trade.order.quantity
                ) / next_quantity
                tracked_quantities[symbol] = next_quantity
                continue

            next_quantity = previous_quantity - trade.order.quantity
            if next_quantity <= _QUANTITY_TOLERANCE:
                tracked_quantities.pop(symbol, None)
                entry_prices.pop(symbol, None)
            else:
                tracked_quantities[symbol] = next_quantity

    @staticmethod
    def _validate_positive_number(value: float, label: str) -> None:
        if isinstance(value, bool) or not isinstance(value, Real):
            raise BacktestError(f"{label} must be numeric.")
        if not isfinite(value) or value <= 0.0:
            raise BacktestError(f"{label} must be finite and greater than zero.")

    @staticmethod
    def _validate_optional_rate(value: float | None, label: str) -> None:
        if value is None:
            return
        Backtester._validate_positive_number(value, label)
        if value > 10.0:
            raise BacktestError(f"{label} cannot exceed 10.0.")

    @staticmethod
    def _validate_allocation(value: float, label: str) -> None:
        Backtester._validate_positive_number(value, label)
        if value > 1.0:
            raise BacktestError(f"{label} cannot exceed 1.0.")

    @staticmethod
    def _validate_market_data(
        market_data: Mapping[str, pd.DataFrame],
    ) -> dict[str, pd.DataFrame]:
        if not market_data:
            raise BacktestError("Market data must contain at least one symbol.")

        normalized_data: dict[str, pd.DataFrame] = {}
        reference_index: pd.DatetimeIndex | None = None
        for raw_symbol, data in market_data.items():
            symbol = normalize_symbol(raw_symbol)
            if symbol in normalized_data:
                raise BacktestError(
                    f"Duplicate market data symbol after normalization: {symbol}."
                )
            validate_ohlcv(data)
            if reference_index is None:
                reference_index = data.index
            elif not data.index.equals(reference_index):
                raise BacktestError("All market data must use the same timestamps.")
            normalized_data[symbol] = data

        return normalized_data

    @staticmethod
    def _validate_target_weights(
        target_weights: pd.DataFrame,
        symbols: tuple[str, ...],
        dates: pd.DatetimeIndex,
    ) -> pd.DataFrame:
        if not isinstance(target_weights, pd.DataFrame):
            raise BacktestError("Target weights must be a pandas DataFrame.")
        if target_weights.empty:
            raise BacktestError("Target weights cannot be empty.")
        if not target_weights.index.equals(dates):
            raise BacktestError("Target weights must use the same timestamps as market data.")
        if not all(isinstance(column, str) for column in target_weights.columns):
            raise BacktestError("Target weight columns must be symbol strings.")

        normalized_columns = [normalize_symbol(column) for column in target_weights.columns]
        if len(set(normalized_columns)) != len(normalized_columns):
            raise BacktestError("Target weights contain duplicate symbols after normalization.")
        if set(normalized_columns) != set(symbols):
            raise BacktestError("Target weight symbols must exactly match market data symbols.")

        weights = target_weights.copy()
        weights.columns = normalized_columns
        weights = weights.loc[:, list(symbols)]
        if not all(pd.api.types.is_numeric_dtype(weights[column]) for column in weights.columns):
            raise BacktestError("Target weights must be numeric.")
        if weights.isnull().any().any():
            raise BacktestError("Target weights cannot contain missing values.")

        values = weights.to_numpy(dtype=float)
        if not np.isfinite(values).all():
            raise BacktestError("Target weights must be finite.")
        if (values < -_WEIGHT_TOLERANCE).any():
            raise BacktestError("Target weights cannot be negative in a long-only backtest.")
        if (weights.sum(axis=1) > 1 + _WEIGHT_TOLERANCE).any():
            raise BacktestError("Target weights cannot sum to more than 1.0.")

        return weights.astype(float)

    def _affordable_quantity(self, portfolio: Portfolio, execution_price: float) -> float:
        cash_after_fixed_fee = portfolio.cash - portfolio.fixed_fee
        if cash_after_fixed_fee <= 0:
            return 0.0
        return cash_after_fixed_fee / (execution_price * (1 + portfolio.commission_rate))
