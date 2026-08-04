"""Tests for interface-neutral research application services."""

from __future__ import annotations

import pandas as pd
import pytest

from samquant.application import (
    MOVING_AVERAGE,
    BacktestConfig,
    ResearchError,
    generate_demo_market_data,
    load_market_data,
    parse_symbols,
    run_backtest,
    run_equal_weight_benchmark,
    run_strategy_study,
)


def test_research_run_exposes_causal_indicators_and_target_weights() -> None:
    market_data = generate_demo_market_data(("AAPL",), periods=80)

    run = run_backtest(
        market_data,
        MOVING_AVERAGE,
        BacktestConfig(initial_cash=10_000.0),
        {"short_window": 5, "long_window": 20},
    )

    assert set(run.evaluation.indicators) == {"short_average", "long_average"}
    assert run.target_weights.equals(run.evaluation.target_weights)
    assert run.result.equity_curve.index.equals(market_data["AAPL"].index)


def test_application_indicators_ignore_future_price_changes() -> None:
    original = generate_demo_market_data(("AAPL",), periods=80)
    changed = {"AAPL": original["AAPL"].copy()}
    final_timestamp = changed["AAPL"].index[-1]
    changed["AAPL"].loc[final_timestamp, ["Open", "High", "Close"]] *= 10.0

    first = run_backtest(
        original,
        MOVING_AVERAGE,
        BacktestConfig(),
        {"short_window": 5, "long_window": 20},
    )
    second = run_backtest(
        changed,
        MOVING_AVERAGE,
        BacktestConfig(),
        {"short_window": 5, "long_window": 20},
    )

    pd.testing.assert_frame_equal(
        first.target_weights.iloc[:-1],
        second.target_weights.iloc[:-1],
    )


def test_equal_weight_benchmark_uses_the_same_execution_engine() -> None:
    market_data = generate_demo_market_data(("AAPL", "MSFT"), periods=30)

    run = run_equal_weight_benchmark(market_data, BacktestConfig())

    assert run.target_weights.iloc[0].to_dict() == {"AAPL": 0.5, "MSFT": 0.5}
    assert run.result.trades[0].timestamp == market_data["AAPL"].index[1]


def test_strategy_study_ranks_fixed_trials_on_the_earlier_period() -> None:
    market_data = generate_demo_market_data(("AAPL", "MSFT"), periods=260)

    study = run_strategy_study(
        market_data,
        BacktestConfig(initial_cash=25_000.0),
        study_parameters={
            "short_window": 12,
            "long_window": 48,
            "lookback_window": 30,
            "entry_z_score": -1.5,
            "exit_z_score": 0.0,
            "top_n": 1,
            "rebalance_frequency": 15,
            "require_positive_returns": True,
        },
    )

    assert len(study.trials) == 19
    assert {trial.strategy_name for trial in study.trials} == {
        "Moving average crossover",
        "Mean reversion",
        "Momentum",
    }
    assert [trial.selection_return for trial in study.trials] == sorted(
        (trial.selection_return for trial in study.trials), reverse=True
    )
    assert any(
        trial.parameters == {"short_window": 12, "long_window": 48}
        for trial in study.trials
    )
    assert len(study.best_by_strategy) == 3
    assert study.holdout_winner in study.best_by_strategy
    for winner in study.best_by_strategy:
        family_trials = (
            trial
            for trial in study.trials
            if trial.strategy_name == winner.strategy_name
        )
        assert winner.selection_return == max(
            trial.selection_return for trial in family_trials
        )

    mean_reversion_trials = [
        trial
        for trial in study.trials
        if trial.strategy_name == "Mean reversion"
    ]
    momentum_trials = [
        trial for trial in study.trials if trial.strategy_name == "Momentum"
    ]
    assert {trial.parameters["lookback_window"] for trial in mean_reversion_trials} == {30}
    assert {trial.parameters["lookback_window"] for trial in momentum_trials} == {30}
    assert {trial.parameters["rebalance_frequency"] for trial in momentum_trials} == {
        5,
        10,
        15,
        21,
        42,
        63,
    }


def test_strategy_study_training_choices_ignore_later_price_changes() -> None:
    original = generate_demo_market_data(("AAPL", "MSFT"), periods=260)
    changed = {symbol: frame.copy() for symbol, frame in original.items()}
    for frame in changed.values():
        frame.loc[frame.index[190]:, ["Open", "High", "Low", "Close"]] *= 4.0
    parameters = {
        "short_window": 12,
        "long_window": 48,
        "lookback_window": 30,
        "entry_z_score": -1.5,
        "exit_z_score": 0.0,
        "top_n": 1,
        "rebalance_frequency": 15,
        "require_positive_returns": True,
    }

    original_study = run_strategy_study(
        original,
        BacktestConfig(initial_cash=25_000.0),
        study_parameters=parameters,
    )
    changed_study = run_strategy_study(
        changed,
        BacktestConfig(initial_cash=25_000.0),
        study_parameters=parameters,
    )

    assert [trial.parameters for trial in original_study.best_by_strategy] == [
        trial.parameters for trial in changed_study.best_by_strategy
    ]


def test_application_bounds_symbols_and_date_ranges() -> None:
    with pytest.raises(ResearchError, match="no more than 6"):
        parse_symbols("A,B,C,D,E,F,G")

    with pytest.raises(ResearchError, match="End date"):
        load_market_data(
            source="demo",
            symbols=("AAPL",),
            start="2024-01-02",
            end="2024-01-02",
        )


def test_yahoo_market_data_requires_explicit_server_permission() -> None:
    with pytest.raises(ResearchError, match="not available"):
        load_market_data(
            source="yahoo",
            symbols=("AAPL",),
            start="2024-01-02",
            end="2024-03-01",
        )
