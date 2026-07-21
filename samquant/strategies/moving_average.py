"""Long-only moving-average crossover strategy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import pandas as pd

from samquant.strategies._common import (
    StrategyError,
    equal_weight_active_positions,
    validate_positive_integer,
    validated_close_prices,
)


@dataclass(frozen=True)
class MovingAverageCrossoverStrategy:
    """Invest when a short moving average is above a long moving average."""

    short_window: int = 50
    long_window: int = 200

    def __post_init__(self) -> None:
        short_window = validate_positive_integer(self.short_window, "Short window")
        long_window = validate_positive_integer(self.long_window, "Long window")
        if short_window >= long_window:
            raise StrategyError("Short window must be smaller than long window.")

        object.__setattr__(self, "short_window", short_window)
        object.__setattr__(self, "long_window", long_window)

    def generate_target_weights(
        self,
        market_data: Mapping[str, pd.DataFrame],
    ) -> pd.DataFrame:
        """Return equal long weights for assets whose short average is higher."""
        close_prices = validated_close_prices(market_data)
        short_average = close_prices.rolling(
            window=self.short_window,
            min_periods=self.short_window,
        ).mean()
        long_average = close_prices.rolling(
            window=self.long_window,
            min_periods=self.long_window,
        ).mean()
        active = short_average.gt(long_average) & long_average.notna()
        return equal_weight_active_positions(active)
