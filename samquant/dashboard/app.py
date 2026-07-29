"""Interactive Streamlit dashboard for running and reviewing SamQuant backtests."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Mapping

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from samquant.dashboard.pipeline import (
    DEFAULT_SYMBOLS,
    MEAN_REVERSION,
    MOMENTUM,
    MOVING_AVERAGE,
    STRATEGY_NAMES,
    DashboardConfig,
    DashboardError,
    DashboardRun,
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
from samquant.data.market_data import get_ohlcv

_GREEN = "#147D64"
_NAVY = "#17324D"
_GOLD = "#D99A2B"
_RED = "#C94C4C"
_GRAY = "#667085"
_PLOT_CONFIG = {"displaylogo": False, "responsive": True}


@st.cache_data(ttl=3_600, show_spinner=False)
def _load_live_market_data(
    symbols: tuple[str, ...],
    start: date,
    end: date,
) -> dict[str, pd.DataFrame]:
    """Download and cache aligned daily OHLCV data for dashboard use."""
    exclusive_end = end + timedelta(days=1)
    return {
        symbol: get_ohlcv(
            symbol,
            start=start.isoformat(),
            end=exclusive_end.isoformat(),
            interval="1d",
        )
        for symbol in symbols
    }


def _apply_dashboard_style() -> None:
    st.markdown(
        """
        <style>
        .stApp {
            background: #F6F8FA;
            color: #17202A;
        }
        [data-testid="stSidebar"] {
            background: #FFFFFF;
            border-right: 1px solid #E4E7EC;
        }
        [data-testid="stMetric"] {
            background: #FFFFFF;
            border: 1px solid #E4E7EC;
            border-top: 3px solid #147D64;
            border-radius: 6px;
            padding: 0.75rem;
        }
        [data-testid="stMetricLabel"] {
            color: #667085;
        }
        div[data-baseweb="tab-list"] {
            gap: 1.5rem;
        }
        div[data-baseweb="tab"] {
            padding-left: 0;
            padding-right: 0;
        }
        h1, h2, h3 {
            color: #17324D;
            letter-spacing: 0;
            white-space: normal;
            overflow-wrap: anywhere;
        }
        h1 {
            font-size: 2rem !important;
        }
        h2 {
            font-size: 1.5rem !important;
        }
        h3 {
            font-size: 1.25rem !important;
        }
        [data-testid="stMetricValue"] {
            color: #17202A;
        }
        @media (max-width: 600px) {
            [data-testid="stMainBlockContainer"] {
                padding-left: 1rem;
                padding-right: 1rem;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _strategy_controls(strategy_name: str, symbol_count: int) -> dict[str, int | float | bool]:
    """Render only the settings relevant to the selected strategy."""
    st.sidebar.subheader("Strategy settings")
    if strategy_name == MOVING_AVERAGE:
        short_window = st.sidebar.number_input(
            "Short moving average",
            min_value=2,
            max_value=250,
            value=50,
            step=1,
        )
        long_window = st.sidebar.number_input(
            "Long moving average",
            min_value=3,
            max_value=500,
            value=200,
            step=1,
        )
        return {
            "short_window": int(short_window),
            "long_window": int(long_window),
        }

    if strategy_name == MEAN_REVERSION:
        lookback_window = st.sidebar.number_input(
            "Z-score lookback",
            min_value=2,
            max_value=250,
            value=20,
            step=1,
        )
        entry_z_score = st.sidebar.number_input(
            "Entry z-score",
            min_value=-5.0,
            max_value=-0.1,
            value=-2.0,
            step=0.1,
        )
        exit_z_score = st.sidebar.number_input(
            "Exit z-score",
            min_value=-2.0,
            max_value=3.0,
            value=0.0,
            step=0.1,
        )
        return {
            "lookback_window": int(lookback_window),
            "entry_z_score": float(entry_z_score),
            "exit_z_score": float(exit_z_score),
        }

    lookback_window = st.sidebar.number_input(
        "Return lookback",
        min_value=2,
        max_value=500,
        value=126,
        step=1,
    )
    top_n = st.sidebar.number_input(
        "Assets to hold",
        min_value=1,
        max_value=max(1, symbol_count),
        value=1,
        step=1,
    )
    rebalance_frequency = st.sidebar.number_input(
        "Rebalance every N bars",
        min_value=1,
        max_value=252,
        value=21,
        step=1,
    )
    require_positive_returns = st.sidebar.checkbox(
        "Hold cash when momentum is negative",
        value=True,
    )
    return {
        "lookback_window": int(lookback_window),
        "top_n": int(top_n),
        "rebalance_frequency": int(rebalance_frequency),
        "require_positive_returns": require_positive_returns,
    }


def _render_metric_strip(run: DashboardRun) -> None:
    metrics = run.metrics
    values = (
        ("Total return", format_percentage(metrics.total_return)),
        ("Annualized return", format_percentage(metrics.annualized_return)),
        ("Volatility", format_percentage(metrics.annualized_volatility)),
        ("Sharpe ratio", format_number(metrics.sharpe_ratio)),
        ("Maximum drawdown", format_percentage(metrics.maximum_drawdown)),
        ("Win rate", format_percentage(metrics.win_rate)),
    )
    for row_values in (values[:3], values[3:]):
        columns = st.columns(3)
        for column, (label, value) in zip(columns, row_values):
            column.metric(label, value)


def _equity_figure(run: DashboardRun, initial_cash: float) -> go.Figure:
    figure = go.Figure()
    figure.add_trace(
        go.Scatter(
            x=run.result.equity_curve.index,
            y=run.result.equity_curve,
            name="Portfolio value",
            line={"color": _GREEN, "width": 2.5},
            hovertemplate="%{x|%b %d, %Y}<br>$%{y:,.0f}<extra></extra>",
        )
    )
    figure.add_hline(
        y=initial_cash,
        line_dash="dot",
        line_color=_GRAY,
        annotation_text="Starting cash",
    )
    figure.update_layout(
        title="Portfolio growth",
        height=410,
        margin={"l": 10, "r": 10, "t": 55, "b": 10},
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        hovermode="x unified",
        legend={"orientation": "h", "y": 1.12, "x": 0},
        yaxis={"title": "Portfolio value", "tickprefix": "$", "tickformat": ",.0f"},
        xaxis={"title": None, "showgrid": False},
    )
    return figure


def _drawdown_figure(run: DashboardRun) -> go.Figure:
    drawdown = drawdown_series(run.result.equity_curve)
    figure = go.Figure(
        go.Scatter(
            x=drawdown.index,
            y=drawdown,
            fill="tozeroy",
            name="Drawdown",
            line={"color": _RED, "width": 1.5},
            fillcolor="rgba(201, 76, 76, 0.18)",
            hovertemplate="%{x|%b %d, %Y}<br>%{y:.1%}<extra></extra>",
        )
    )
    figure.update_layout(
        title="Loss from the previous portfolio high",
        height=300,
        margin={"l": 10, "r": 10, "t": 55, "b": 10},
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        showlegend=False,
        yaxis={"tickformat": ".0%", "title": "Drawdown"},
        xaxis={"title": None, "showgrid": False},
    )
    return figure


def _comparison_figure(runs: Mapping[str, DashboardRun]) -> go.Figure:
    normalized = normalized_equity_frame(runs)
    colors = (_GREEN, _GOLD, _NAVY, _RED)
    figure = go.Figure()
    for (name, values), color in zip(normalized.items(), colors):
        figure.add_trace(
            go.Scatter(
                x=normalized.index,
                y=values,
                name=name,
                line={"color": color, "width": 2},
                hovertemplate="%{x|%b %d, %Y}<br>%{y:.1f}<extra></extra>",
            )
        )
    figure.update_layout(
        title="Strategy growth comparison",
        height=430,
        margin={"l": 10, "r": 10, "t": 55, "b": 10},
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        hovermode="x unified",
        legend={"orientation": "h", "y": 1.16, "x": 0},
        yaxis={"title": "Starting value rebased to 100"},
        xaxis={"title": None, "showgrid": False},
    )
    return figure


def _render_overview(run: DashboardRun, config: DashboardConfig) -> None:
    st.plotly_chart(
        _equity_figure(run, config.initial_cash),
        config=_PLOT_CONFIG,
    )
    st.plotly_chart(
        _drawdown_figure(run),
        config=_PLOT_CONFIG,
    )

    latest_positions = run.result.positions.iloc[-1]
    held_positions = latest_positions[latest_positions.abs() > 1e-10]
    summary_columns = st.columns(3)
    summary_columns[0].metric("Final value", f"${run.result.final_value:,.0f}")
    summary_columns[1].metric("Completed executions", f"{len(run.result.trades):,}")
    summary_columns[2].metric("Current holdings", f"{len(held_positions):,}")


def _render_trades(run: DashboardRun) -> None:
    trades = trades_frame(run.result)
    if trades.empty:
        st.info("This strategy did not execute any trades in the selected period.")
        return

    buys = int((trades["Side"] == "BUY").sum())
    sells = int((trades["Side"] == "SELL").sum())
    total_fees = float(trades["Fee"].sum())
    columns = st.columns(3)
    columns[0].metric("Buy executions", f"{buys:,}")
    columns[1].metric("Sell executions", f"{sells:,}")
    columns[2].metric("Total transaction fees", f"${total_fees:,.2f}")
    st.dataframe(
        trades,
        width="stretch",
        hide_index=True,
        column_config={
            "Date": st.column_config.DatetimeColumn("Date", format="YYYY-MM-DD"),
            "Quantity": st.column_config.NumberColumn("Quantity", format="%.4f"),
            "Price": st.column_config.NumberColumn("Price", format="$%.2f"),
            "Notional": st.column_config.NumberColumn("Notional", format="$%.2f"),
            "Fee": st.column_config.NumberColumn("Fee", format="$%.2f"),
            "Cash effect": st.column_config.NumberColumn("Cash effect", format="$%.2f"),
        },
    )


def _render_comparison(runs: Mapping[str, DashboardRun]) -> None:
    st.plotly_chart(
        _comparison_figure(runs),
        config=_PLOT_CONFIG,
    )
    comparison = comparison_metrics_frame(runs)
    percentage_columns = (
        "Total return",
        "Annualized return",
        "Volatility",
        "Maximum drawdown",
        "Win rate",
    )
    comparison.loc[:, percentage_columns] *= 100.0
    st.dataframe(
        comparison,
        width="stretch",
        column_config={
            "Total return": st.column_config.NumberColumn(format="%.1f%%"),
            "Annualized return": st.column_config.NumberColumn(format="%.1f%%"),
            "Volatility": st.column_config.NumberColumn(format="%.1f%%"),
            "Sharpe ratio": st.column_config.NumberColumn(format="%.2f"),
            "Maximum drawdown": st.column_config.NumberColumn(format="%.1f%%"),
            "Win rate": st.column_config.NumberColumn(format="%.1f%%"),
            "Trades": st.column_config.NumberColumn(format="%d"),
        },
    )
    st.caption(
        "The equal-weight benchmark invests across the selected assets. "
        "It is a comparison point, not proof that any strategy will work in the future."
    )


def _render_data(
    market_data: Mapping[str, pd.DataFrame],
    run: DashboardRun,
) -> None:
    close_prices = pd.DataFrame(
        {symbol: frame["Close"] for symbol, frame in market_data.items()}
    )
    st.markdown("#### Closing prices")
    st.line_chart(close_prices)
    st.markdown("#### Strategy target weights")
    st.dataframe(
        run.target_weights.tail(50),
        width="stretch",
        column_config={
            symbol: st.column_config.NumberColumn(symbol, format="%.1f%%")
            for symbol in run.target_weights.columns
        },
    )
    st.caption("Target weights are delayed by one bar before execution at the next open.")


def main() -> None:
    """Render the complete Phase 6 dashboard."""
    st.set_page_config(page_title="SamQuant", page_icon="SQ", layout="wide")
    _apply_dashboard_style()

    st.title("SamQuant")
    st.caption("Historical strategy research, execution simulation, and risk analysis")

    st.sidebar.header("Backtest controls")
    source = st.sidebar.radio(
        "Data source",
        ("Demo data", "Yahoo Finance"),
        help="Demo data is deterministic and works without an internet connection.",
    )
    raw_symbols = st.sidebar.text_input(
        "Ticker symbols",
        value=", ".join(DEFAULT_SYMBOLS),
        help="Enter one or more comma-separated ticker symbols.",
    )

    try:
        symbols = parse_symbols(raw_symbols)
    except (DashboardError, ValueError) as error:
        st.error(str(error))
        st.stop()

    if source == "Yahoo Finance":
        default_end = date.today() - timedelta(days=1)
        default_start = default_end - timedelta(days=3 * 365)
        start_date = st.sidebar.date_input("Start date", value=default_start)
        end_date = st.sidebar.date_input("End date", value=default_end)
        if start_date >= end_date:
            st.error("The start date must be earlier than the end date.")
            st.stop()

    strategy_name = st.sidebar.selectbox("Strategy", STRATEGY_NAMES)
    strategy_parameters = _strategy_controls(strategy_name, len(symbols))

    st.sidebar.subheader("Execution settings")
    initial_cash = st.sidebar.number_input(
        "Starting cash",
        min_value=1_000.0,
        value=100_000.0,
        step=5_000.0,
        format="%.2f",
    )
    commission_percent = st.sidebar.number_input(
        "Commission per trade (%)",
        min_value=0.0,
        max_value=5.0,
        value=0.10,
        step=0.01,
        format="%.2f",
    )
    fixed_fee = st.sidebar.number_input(
        "Fixed fee per trade",
        min_value=0.0,
        value=0.0,
        step=0.25,
        format="%.2f",
    )
    slippage_bps = st.sidebar.number_input(
        "Slippage (basis points)",
        min_value=0.0,
        max_value=500.0,
        value=5.0,
        step=1.0,
    )
    risk_free_percent = st.sidebar.number_input(
        "Annual risk-free rate (%)",
        min_value=-99.0,
        max_value=50.0,
        value=0.0,
        step=0.25,
        format="%.2f",
    )
    st.sidebar.caption("Results update when a control changes.")

    config = DashboardConfig(
        initial_cash=float(initial_cash),
        commission_rate=float(commission_percent) / 100.0,
        fixed_fee=float(fixed_fee),
        slippage_bps=float(slippage_bps),
        risk_free_rate=float(risk_free_percent) / 100.0,
    )

    try:
        with st.spinner("Preparing market data and running the historical simulation..."):
            if source == "Demo data":
                market_data = generate_demo_market_data(symbols)
            else:
                market_data = _load_live_market_data(symbols, start_date, end_date)

            primary_run = run_dashboard_backtest(
                market_data,
                strategy_name,
                config,
                strategy_parameters,
            )
            comparison_runs = run_strategy_comparison(
                market_data,
                config,
                primary_run=primary_run,
            )
    except Exception as error:
        st.error(f"SamQuant could not complete this backtest: {error}")
        st.stop()

    source_label = "deterministic demo data" if source == "Demo data" else "Yahoo Finance"
    st.markdown(f"### {strategy_name}")
    st.caption(
        f"{', '.join(symbols)} | {source_label} | "
        f"{primary_run.result.equity_curve.index[0]:%b %d, %Y} to "
        f"{primary_run.result.equity_curve.index[-1]:%b %d, %Y}"
    )
    _render_metric_strip(primary_run)

    overview_tab, trades_tab, comparison_tab, data_tab = st.tabs(
        ("Overview", "Trades", "Strategy comparison", "Data and signals")
    )
    with overview_tab:
        _render_overview(primary_run, config)
    with trades_tab:
        _render_trades(primary_run)
    with comparison_tab:
        _render_comparison(comparison_runs)
    with data_tab:
        _render_data(market_data, primary_run)

    st.divider()
    st.caption(
        "Research use only. Every signal is executed at the next market open, "
        "and the simulation includes the selected fees and slippage. Historical "
        "results do not guarantee future performance."
    )


if __name__ == "__main__":
    main()
