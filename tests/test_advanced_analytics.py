"""Focused tests for portfolio optimization and Monte Carlo analytics."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from samquant.analytics import (
    MonteCarloError,
    PortfolioAnalysisError,
    analyze_portfolio,
    simulate_portfolio,
)


def _market_data() -> dict[str, pd.DataFrame]:
    dates = pd.bdate_range("2024-01-02", periods=80, name="Date")
    data: dict[str, pd.DataFrame] = {}
    for symbol, drift, phase in (("AAPL", 0.0010, 0.0), ("MSFT", 0.0006, 0.7)):
        returns = drift + np.sin(np.linspace(phase, phase + 8.0, len(dates))) * 0.004
        close = 100.0 * np.cumprod(1.0 + returns)
        data[symbol] = pd.DataFrame(
            {
                "Open": close,
                "High": close * 1.01,
                "Low": close * 0.99,
                "Close": close,
                "Volume": np.full(len(dates), 1_000_000),
            },
            index=dates,
        )
    return data


def test_portfolio_analysis_returns_valid_long_only_weights() -> None:
    analysis = analyze_portfolio(_market_data(), samples=500, seed=7)

    assert analysis.max_sharpe_weights.sum() == pytest.approx(1.0)
    assert (analysis.max_sharpe_weights >= 0.0).all()
    assert analysis.correlation_matrix.shape == (2, 2)
    assert analysis.covariance_matrix.shape == (2, 2)
    assert not analysis.frontier.empty
    assert analysis.volatility >= 0.0


@pytest.mark.parametrize("risk_free_rate", (float("nan"), True, "0.05"))
def test_portfolio_analysis_rejects_invalid_risk_free_rate(
    risk_free_rate: object,
) -> None:
    with pytest.raises(PortfolioAnalysisError, match="must be finite"):
        analyze_portfolio(_market_data(), risk_free_rate=risk_free_rate)


@pytest.mark.parametrize(
    "settings",
    ({"periods_per_year": True}, {"samples": 100.5}),
)
def test_portfolio_analysis_requires_integer_settings(
    settings: dict[str, object],
) -> None:
    with pytest.raises(PortfolioAnalysisError, match="Periods must be positive"):
        analyze_portfolio(_market_data(), **settings)


def test_monte_carlo_is_reproducible_and_reports_tail_statistics() -> None:
    closes = pd.DataFrame(
        {symbol: frame["Close"] for symbol, frame in _market_data().items()}
    )
    returns = closes.pct_change(fill_method=None).dropna()
    weights = pd.Series({"AAPL": 0.5, "MSFT": 0.5})

    first = simulate_portfolio(
        returns,
        weights,
        initial_value=10_000.0,
        horizon=40,
        simulations=100,
        seed=11,
    )
    second = simulate_portfolio(
        returns,
        weights,
        initial_value=10_000.0,
        horizon=40,
        simulations=100,
        seed=11,
    )

    pd.testing.assert_frame_equal(first.paths, second.paths)
    assert first.paths.shape == (41, 100)
    assert first.percentile_5 <= first.median_ending_value <= first.percentile_95
    assert 0.0 <= first.probability_below_start <= 1.0


@pytest.mark.parametrize("initial_value", (float("nan"), True, "10000"))
def test_monte_carlo_rejects_invalid_initial_value(initial_value: object) -> None:
    returns = pd.DataFrame({"AAPL": [0.01, -0.01]})
    weights = pd.Series({"AAPL": 1.0})

    with pytest.raises(MonteCarloError, match="must be positive"):
        simulate_portfolio(
            returns,
            weights,
            initial_value=initial_value,
            horizon=10,
            simulations=10,
            seed=1,
        )


def test_monte_carlo_rejects_non_finite_weights() -> None:
    returns = pd.DataFrame({"AAPL": [0.01, -0.01], "MSFT": [0.02, -0.02]})
    weights = pd.Series({"AAPL": float("nan"), "MSFT": 1.0})

    with pytest.raises(MonteCarloError, match="non-negative and sum to one"):
        simulate_portfolio(
            returns,
            weights,
            initial_value=10_000.0,
            horizon=10,
            simulations=10,
            seed=1,
        )


@pytest.mark.parametrize(
    "settings",
    (
        {"horizon": True, "simulations": 10},
        {"horizon": 10, "simulations": 10.5},
    ),
)
def test_monte_carlo_requires_integer_counts(settings: dict[str, object]) -> None:
    returns = pd.DataFrame({"AAPL": [0.01, -0.01]})
    weights = pd.Series({"AAPL": 1.0})

    with pytest.raises(MonteCarloError, match="must be positive"):
        simulate_portfolio(
            returns,
            weights,
            initial_value=10_000.0,
            seed=1,
            **settings,
        )
