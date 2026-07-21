"""Long-only cross-sectional momentum strategy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import pandas as pd

from samquant.strategies._common import (
    StrategyError,
    validate_positive_integer,
    validated_close_prices,
)


@dataclass(frozen=True)
class MomentumStrategy:
    """Equal-weight assets with the strongest trailing returns."""

    lookback_window: int = 126
    top_n: int = 1
    rebalance_frequency: int = 21
    require_positive_returns: bool = True

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "lookback_window",
            validate_positive_integer(self.lookback_window, "Lookback window"),
        )
        object.__setattr__(
            self,
            "top_n",
            validate_positive_integer(self.top_n, "Top asset count"),
        )
        object.__setattr__(
            self,
            "rebalance_frequency",
            validate_positive_integer(
                self.rebalance_frequency,
                "Rebalance frequency",
            ),
        )
        if not isinstance(self.require_positive_returns, bool):
            raise StrategyError("Require-positive-returns setting must be boolean.")

    def generate_target_weights(
        self,
        market_data: Mapping[str, pd.DataFrame],
    ) -> pd.DataFrame:
        """Rank trailing returns and hold equal weights until the next rebalance."""
        close_prices = validated_close_prices(market_data)
        trailing_returns = close_prices / close_prices.shift(self.lookback_window) - 1.0
        weights = pd.DataFrame(
            0.0,
            index=close_prices.index,
            columns=close_prices.columns,
        )
        current_weights = pd.Series(0.0, index=close_prices.columns, dtype=float)

        for position in range(len(close_prices.index)):
            should_rebalance = (
                position >= self.lookback_window
                and (position - self.lookback_window) % self.rebalance_frequency == 0
            )
            if should_rebalance:
                scores = trailing_returns.iloc[position].dropna().sort_index()
                if self.require_positive_returns:
                    scores = scores[scores > 0]
                winners = scores.sort_values(
                    ascending=False,
                    kind="mergesort",
                ).index[: self.top_n]

                current_weights = pd.Series(
                    0.0,
                    index=close_prices.columns,
                    dtype=float,
                )
                if len(winners) > 0:
                    current_weights.loc[winners] = 1.0 / len(winners)

            weights.iloc[position] = current_weights

        return weights
