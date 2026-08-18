"""Reproducible Monte Carlo simulations for fixed-weight portfolios."""

from __future__ import annotations

from dataclasses import dataclass
from numbers import Integral, Real

import numpy as np
import pandas as pd


class MonteCarloError(ValueError):
    """Raised when simulation inputs are invalid."""


@dataclass(frozen=True)
class MonteCarloResult:
    """Simulated paths and ending-value statistics."""

    paths: pd.DataFrame
    ending_values: pd.Series
    median_ending_value: float
    mean_ending_value: float
    probability_below_start: float
    percentile_5: float
    percentile_95: float


def simulate_portfolio(
    asset_returns: pd.DataFrame,
    weights: pd.Series,
    *,
    initial_value: float,
    horizon: int,
    simulations: int,
    seed: int,
) -> MonteCarloResult:
    """Simulate correlated daily returns using historical mean and covariance."""
    if asset_returns.empty or len(asset_returns) < 2:
        raise MonteCarloError("Monte Carlo simulation needs historical returns.")
    if (
        isinstance(initial_value, bool)
        or not isinstance(initial_value, Real)
        or not np.isfinite(initial_value)
        or initial_value <= 0
        or isinstance(horizon, bool)
        or not isinstance(horizon, Integral)
        or horizon <= 0
        or isinstance(simulations, bool)
        or not isinstance(simulations, Integral)
        or simulations <= 0
    ):
        raise MonteCarloError(
            "Initial value, horizon, and simulations must be positive."
        )
    if set(weights.index) != set(asset_returns.columns):
        raise MonteCarloError("Weights must match the asset-return columns.")
    normalized_weights = weights.reindex(asset_returns.columns).astype(float)
    if (
        not np.isfinite(normalized_weights).all()
        or (normalized_weights < 0).any()
        or not np.isclose(normalized_weights.sum(), 1.0)
    ):
        raise MonteCarloError("Weights must be non-negative and sum to one.")

    generator = np.random.default_rng(seed)
    simulated_assets = generator.multivariate_normal(
        asset_returns.mean().to_numpy(),
        asset_returns.cov().to_numpy(),
        size=(horizon, simulations),
        check_valid="ignore",
    )
    portfolio_returns = np.einsum(
        "hsa,a->hs", simulated_assets, normalized_weights.to_numpy()
    )
    portfolio_returns = np.maximum(portfolio_returns, -0.999999)
    values = initial_value * np.cumprod(1.0 + portfolio_returns, axis=0)
    values = np.vstack((np.full(simulations, initial_value), values))
    paths = pd.DataFrame(values, index=pd.RangeIndex(horizon + 1, name="Day"))
    ending_values = paths.iloc[-1].rename("Ending value")

    return MonteCarloResult(
        paths=paths,
        ending_values=ending_values,
        median_ending_value=float(ending_values.median()),
        mean_ending_value=float(ending_values.mean()),
        probability_below_start=float((ending_values < initial_value).mean()),
        percentile_5=float(ending_values.quantile(0.05)),
        percentile_95=float(ending_values.quantile(0.95)),
    )
