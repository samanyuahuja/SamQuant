"""Shared validation and allocation helpers for trading strategies."""

from __future__ import annotations

from numbers import Integral
from typing import Mapping

import pandas as pd

from samquant.data.market_data import normalize_symbol, validate_ohlcv


class StrategyError(ValueError):
    """Raised when strategy configuration or market data is invalid."""


def validated_close_prices(
    market_data: Mapping[str, pd.DataFrame],
) -> pd.DataFrame:
    """Return aligned closing prices after validating every input data set."""
    if not market_data:
        raise StrategyError("Market data must contain at least one symbol.")

    normalized_data: dict[str, pd.DataFrame] = {}
    reference_index: pd.DatetimeIndex | None = None
    for raw_symbol, data in market_data.items():
        symbol = normalize_symbol(raw_symbol)
        if symbol in normalized_data:
            raise StrategyError(
                f"Duplicate market data symbol after normalization: {symbol}."
            )
        validate_ohlcv(data)
        if reference_index is None:
            reference_index = data.index
        elif not data.index.equals(reference_index):
            raise StrategyError("All strategy market data must use the same timestamps.")
        normalized_data[symbol] = data

    symbols = sorted(normalized_data)
    return pd.DataFrame(
        {symbol: normalized_data[symbol]["Close"].astype(float) for symbol in symbols},
        index=reference_index,
    )


def equal_weight_active_positions(active: pd.DataFrame) -> pd.DataFrame:
    """Split 100% exposure equally across active long positions."""
    active_counts = active.sum(axis=1).astype(float)
    divisors = active_counts.where(active_counts > 0, float("nan"))
    weights = active.astype(float).div(divisors, axis=0).fillna(0.0)
    return weights.astype(float)


def validate_positive_integer(value: int, label: str) -> int:
    """Validate and normalize a positive integer strategy setting."""
    if isinstance(value, bool) or not isinstance(value, Integral) or value <= 0:
        raise StrategyError(f"{label} must be a positive integer.")
    return int(value)
