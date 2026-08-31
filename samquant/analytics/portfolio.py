"""Long-only portfolio optimization and diversification analytics."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from numbers import Integral, Real

import numpy as np
import pandas as pd

from samquant.data.market_data import validate_ohlcv


class PortfolioAnalysisError(ValueError):
    """Raised when market data cannot support portfolio analysis."""


@dataclass(frozen=True)
class PortfolioAnalysis:
    """Historical asset statistics and an approximate long-only frontier."""

    annualized_asset_returns: pd.Series
    correlation_matrix: pd.DataFrame
    covariance_matrix: pd.DataFrame
    frontier: pd.DataFrame
    max_sharpe_weights: pd.Series
    expected_return: float
    volatility: float
    sharpe_ratio: float
    diversification_ratio: float


def analyze_portfolio(
    market_data: Mapping[str, pd.DataFrame],
    *,
    periods_per_year: int = 252,
    risk_free_rate: float = 0.0,
    samples: int = 2_500,
    seed: int = 42,
) -> PortfolioAnalysis:
    """Estimate a reproducible long-only efficient frontier from historical returns."""
    if not market_data:
        raise PortfolioAnalysisError("Portfolio analysis requires market data.")
    if (
        isinstance(periods_per_year, bool)
        or not isinstance(periods_per_year, Integral)
        or isinstance(samples, bool)
        or not isinstance(samples, Integral)
        or periods_per_year <= 0
        or samples < 100
    ):
        raise PortfolioAnalysisError("Periods must be positive and samples at least 100.")
    if (
        isinstance(risk_free_rate, bool)
        or not isinstance(risk_free_rate, Real)
        or not np.isfinite(risk_free_rate)
        or risk_free_rate <= -1.0
    ):
        raise PortfolioAnalysisError("Risk-free rate must be finite and greater than -1.")
    if isinstance(seed, bool) or not isinstance(seed, Integral) or seed < 0:
        raise PortfolioAnalysisError("Seed must be a non-negative integer.")

    closes: dict[str, pd.Series] = {}
    for symbol, frame in market_data.items():
        validate_ohlcv(frame)
        closes[symbol] = frame["Close"].astype(float)
    returns = pd.DataFrame(closes).pct_change(fill_method=None).dropna()
    if len(returns) < 2:
        raise PortfolioAnalysisError("Portfolio analysis needs at least three price bars.")

    annual_returns = returns.mean() * periods_per_year
    covariance = returns.cov() * periods_per_year
    correlation = returns.corr()
    if not (np.diag(covariance.to_numpy()) > 0.0).any():
        raise PortfolioAnalysisError(
            "Portfolio analysis needs price variability in at least one asset."
        )
    asset_count = len(annual_returns)
    generator = np.random.default_rng(seed)
    weights = generator.dirichlet(np.ones(asset_count), size=samples)
    weights = np.vstack(
        (weights, np.eye(asset_count), np.full(asset_count, 1 / asset_count))
    )
    portfolio_returns = weights @ annual_returns.to_numpy()
    portfolio_variances = np.einsum(
        "ij,jk,ik->i", weights, covariance.to_numpy(), weights
    )
    portfolio_volatility = np.sqrt(np.maximum(portfolio_variances, 0.0))
    sharpe = np.divide(
        portfolio_returns - risk_free_rate,
        portfolio_volatility,
        out=np.full_like(portfolio_returns, -np.inf),
        where=portfolio_volatility > 1e-12,
    )
    winner = int(np.argmax(sharpe))
    frontier = _frontier_points(portfolio_volatility, portfolio_returns)
    winner_weights = pd.Series(
        weights[winner], index=annual_returns.index, name="Weight"
    )
    weighted_asset_volatility = float(
        winner_weights.to_numpy() @ np.sqrt(np.diag(covariance.to_numpy()))
    )
    winner_volatility = float(portfolio_volatility[winner])

    return PortfolioAnalysis(
        annualized_asset_returns=annual_returns,
        correlation_matrix=correlation,
        covariance_matrix=covariance,
        frontier=frontier,
        max_sharpe_weights=winner_weights,
        expected_return=float(portfolio_returns[winner]),
        volatility=winner_volatility,
        sharpe_ratio=float(sharpe[winner]),
        diversification_ratio=(
            weighted_asset_volatility / winner_volatility
            if winner_volatility > 1e-12
            else float("nan")
        ),
    )


def _frontier_points(volatility: np.ndarray, returns: np.ndarray) -> pd.DataFrame:
    ordered = np.argsort(volatility)
    points: list[tuple[float, float]] = []
    best_return = -np.inf
    for index in ordered:
        candidate_return = float(returns[index])
        if candidate_return > best_return + 1e-10:
            points.append((float(volatility[index]), candidate_return))
            best_return = candidate_return
    if len(points) > 120:
        selected = np.linspace(0, len(points) - 1, 120, dtype=int)
        points = [points[index] for index in selected]
    return pd.DataFrame(points, columns=["Volatility", "Expected return"])
