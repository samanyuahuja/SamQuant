"""Strategy outputs used by execution engines and research interfaces."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class StrategyEvaluation:
    """Target weights plus the causal indicators that produced them."""

    target_weights: pd.DataFrame
    indicators: Mapping[str, pd.DataFrame]
