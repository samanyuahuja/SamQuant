"""Long-only rolling z-score mean-reversion strategy."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from numbers import Real
from typing import Mapping

import numpy as np
import pandas as pd

from samquant.strategies._common import (
    StrategyError,
    equal_weight_active_positions,
    validate_positive_integer,
    validated_close_prices,
)


@dataclass(frozen=True)
class MeanReversionStrategy:
    """Buy unusually low prices and exit after they recover toward the mean."""

    lookback_window: int = 20
    entry_z_score: float = -2.0
    exit_z_score: float = 0.0

    def __post_init__(self) -> None:
        lookback_window = validate_positive_integer(
            self.lookback_window,
            "Lookback window",
        )
        if lookback_window < 2:
            raise StrategyError("Lookback window must be at least 2.")
        if not self._is_finite_number(self.entry_z_score):
            raise StrategyError("Entry z-score must be a finite number.")
        if not self._is_finite_number(self.exit_z_score):
            raise StrategyError("Exit z-score must be a finite number.")
        if self.entry_z_score >= self.exit_z_score:
            raise StrategyError("Entry z-score must be smaller than exit z-score.")

        object.__setattr__(self, "lookback_window", lookback_window)
        object.__setattr__(self, "entry_z_score", float(self.entry_z_score))
        object.__setattr__(self, "exit_z_score", float(self.exit_z_score))

    def generate_target_weights(
        self,
        market_data: Mapping[str, pd.DataFrame],
    ) -> pd.DataFrame:
        """Return stateful long weights from rolling closing-price z-scores."""
        close_prices = validated_close_prices(market_data)
        rolling_mean = close_prices.rolling(
            window=self.lookback_window,
            min_periods=self.lookback_window,
        ).mean()
        rolling_std = close_prices.rolling(
            window=self.lookback_window,
            min_periods=self.lookback_window,
        ).std(ddof=0)
        z_scores = (close_prices - rolling_mean) / rolling_std.replace(0.0, np.nan)

        active = pd.DataFrame(False, index=close_prices.index, columns=close_prices.columns)
        for symbol in close_prices.columns:
            is_long = False
            for timestamp, z_score in z_scores[symbol].items():
                if pd.notna(z_score):
                    if not is_long and z_score <= self.entry_z_score:
                        is_long = True
                    elif is_long and z_score >= self.exit_z_score:
                        is_long = False
                active.at[timestamp, symbol] = is_long

        return equal_weight_active_positions(active)

    @staticmethod
    def _is_finite_number(value: float) -> bool:
        return (
            not isinstance(value, bool)
            and isinstance(value, Real)
            and isfinite(value)
        )
