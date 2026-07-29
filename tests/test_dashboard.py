"""Tests for the Phase 6 dashboard pipeline and Streamlit entry point."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
from streamlit.testing.v1 import AppTest

from samquant.data.market_data import validate_ohlcv
from samquant.dashboard import (
    EQUAL_WEIGHT_BENCHMARK,
    INDIA_BSE,
    INDIA_NSE,
    MEAN_REVERSION,
    MOMENTUM,
    MOVING_AVERAGE,
    DashboardConfig,
    DashboardError,
    comparison_metrics_frame,
    drawdown_series,
    format_number,
    format_percentage,
    generate_demo_market_data,
    normalized_equity_frame,
    parse_symbols,
    run_dashboard_backtest,
    run_strategy_comparison,
    trades_frame,
)


def test_parse_symbols_normalizes_and_deduplicates_tickers() -> None:
    assert parse_symbols(" aapl, MSFT, aapl ") == ("AAPL", "MSFT")


def test_parse_symbols_adds_indian_exchange_suffixes() -> None:
    assert parse_symbols("reliance, TCS", INDIA_NSE) == (
        "RELIANCE.NS",
        "TCS.NS",
    )
    assert parse_symbols("reliance, TCS", INDIA_BSE) == (
        "RELIANCE.BO",
        "TCS.BO",
    )


def test_parse_symbols_preserves_complete_tickers_and_indices() -> None:
    assert parse_symbols("RELIANCE.NS, ^NSEI", INDIA_NSE) == (
        "RELIANCE.NS",
        "^NSEI",
    )


def test_parse_symbols_rejects_an_empty_list() -> None:
    with pytest.raises(DashboardError, match="at least one"):
        parse_symbols(" , ")


def test_parse_symbols_rejects_an_unknown_market() -> None:
    with pytest.raises(DashboardError, match="Unsupported market"):
        parse_symbols("AAPL", "Unknown")


def test_demo_market_data_is_deterministic_and_valid() -> None:
    first = generate_demo_market_data(("AAPL", "MSFT"), periods=30)
    second = generate_demo_market_data(("AAPL", "MSFT"), periods=30)

    assert tuple(first) == ("AAPL", "MSFT")
    for symbol in first:
        validate_ohlcv(first[symbol])
        pd.testing.assert_frame_equal(first[symbol], second[symbol])


def test_dashboard_pipeline_runs_strategy_engine_and_analytics() -> None:
    market_data = generate_demo_market_data(("AAPL",), periods=80)
    config = DashboardConfig(
        initial_cash=10_000.0,
        commission_rate=0.001,
        slippage_bps=5.0,
    )

    run = run_dashboard_backtest(
        market_data,
        MOVING_AVERAGE,
        config,
        {"short_window": 5, "long_window": 20},
    )

    assert run.strategy_name == MOVING_AVERAGE
    assert run.result.equity_curve.index.equals(market_data["AAPL"].index)
    assert run.result.final_value > 0.0
    assert run.target_weights.shape == (80, 1)
    assert isinstance(run.metrics.total_return, float)


def test_dashboard_tables_preserve_trade_and_risk_information() -> None:
    market_data = generate_demo_market_data(("AAPL",), periods=100)
    run = run_dashboard_backtest(
        market_data,
        MOVING_AVERAGE,
        DashboardConfig(),
        {"short_window": 3, "long_window": 10},
    )

    trades = trades_frame(run.result)
    drawdown = drawdown_series(run.result.equity_curve)

    assert trades.columns.tolist() == [
        "Date",
        "Symbol",
        "Side",
        "Quantity",
        "Price",
        "Notional",
        "Fee",
        "Cash effect",
    ]
    assert (drawdown <= 0.0).all()
    assert drawdown.iloc[0] == pytest.approx(0.0)


def test_strategy_comparison_uses_same_scale_and_includes_benchmark() -> None:
    market_data = generate_demo_market_data(("AAPL", "MSFT"), periods=260)
    runs = run_strategy_comparison(market_data, DashboardConfig())

    assert set(runs) == {
        MOVING_AVERAGE,
        MEAN_REVERSION,
        MOMENTUM,
        EQUAL_WEIGHT_BENCHMARK,
    }
    normalized = normalized_equity_frame(runs)
    metrics = comparison_metrics_frame(runs)
    assert (normalized.iloc[0] == 100.0).all()
    assert metrics.index.tolist() == list(runs)
    assert (metrics["Trades"] >= 0).all()


def test_metric_formatters_do_not_present_undefined_values_as_zero() -> None:
    assert format_percentage(float("nan")) == "N/A"
    assert format_number(float("nan")) == "N/A"
    assert format_percentage(0.125) == "12.5%"
    assert format_number(1.234) == "1.23"


def test_streamlit_dashboard_starts_with_demo_data() -> None:
    app_path = Path(__file__).parents[1] / "samquant" / "dashboard" / "app.py"

    app = AppTest.from_file(str(app_path)).run(timeout=30)

    assert not app.exception
    assert app.title[0].value == "SamQuant"
    assert any(tab.label == "Strategy comparison" for tab in app.tabs)

    app.selectbox[0].select(INDIA_NSE).run(timeout=30)

    assert not app.exception
    assert app.text_input[0].value == "RELIANCE, TCS, INFY"
