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


@pytest.mark.parametrize(
    "risk_free_rate", (float("nan"), True, "0.05", -1.0, -1.5)
)
def test_portfolio_analysis_rejects_invalid_risk_free_rate(
    risk_free_rate: object,
) -> None:
    with pytest.raises(PortfolioAnalysisError, match="greater than -1"):
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


@pytest.mark.parametrize("seed", (True, -1, 1.5))
def test_portfolio_analysis_requires_non_negative_integer_seed(seed: object) -> None:
    with pytest.raises(PortfolioAnalysisError, match="non-negative integer"):
        analyze_portfolio(_market_data(), seed=seed)


@pytest.mark.parametrize(
    "market_data, message",
    (({" ": _market_data()["AAPL"]}, "non-empty"),
     ({"AAPL": _market_data()["AAPL"], " aapl ": _market_data()["MSFT"]}, "unique")),
)
def test_portfolio_analysis_validates_asset_symbols(
    market_data: dict[str, pd.DataFrame],
    message: str,
) -> None:
    with pytest.raises(PortfolioAnalysisError, match=message):
        analyze_portfolio(market_data)


def test_portfolio_analysis_rejects_flat_price_histories() -> None:
    market_data = _market_data()
    for frame in market_data.values():
        frame.loc[:, ["Open", "Close"]] = 100.0
        frame.loc[:, "High"] = 101.0
        frame.loc[:, "Low"] = 99.0

    with pytest.raises(PortfolioAnalysisError, match="price variability"):
        analyze_portfolio(market_data)


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


@pytest.mark.parametrize("invalid_return", (float("nan"), float("inf"), "bad"))
def test_monte_carlo_rejects_invalid_asset_returns(
    invalid_return: object,
) -> None:
    returns = pd.DataFrame({"AAPL": [0.01, invalid_return]})
    weights = pd.Series({"AAPL": 1.0})

    with pytest.raises(MonteCarloError, match="finite numeric values"):
        simulate_portfolio(
            returns,
            weights,
            initial_value=10_000.0,
            horizon=10,
            simulations=10,
            seed=1,
        )


@pytest.mark.parametrize("duplicate_source", ("returns", "weights"))
def test_monte_carlo_rejects_duplicate_asset_labels(
    duplicate_source: str,
) -> None:
    returns = pd.DataFrame({"AAPL": [0.01, -0.01]})
    weights = pd.Series({"AAPL": 1.0})
    if duplicate_source == "returns":
        returns = pd.DataFrame(
            [[0.01, 0.02], [-0.01, -0.02]], columns=["AAPL", "AAPL"]
        )
    else:
        weights = pd.Series([0.5, 0.5], index=["AAPL", "AAPL"])

    with pytest.raises(MonteCarloError, match="labels must be unique"):
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


@pytest.mark.parametrize("seed", (True, -1, 1.5))
def test_monte_carlo_requires_non_negative_integer_seed(seed: object) -> None:
    returns = pd.DataFrame({"AAPL": [0.01, -0.01]})
    weights = pd.Series({"AAPL": 1.0})

    with pytest.raises(MonteCarloError, match="non-negative integer"):
        simulate_portfolio(
            returns,
            weights,
            initial_value=10_000.0,
            horizon=10,
            simulations=10,
            seed=seed,
        )
