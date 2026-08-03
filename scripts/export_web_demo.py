"""Export one deterministic API response for the public web demonstration."""

from __future__ import annotations

import json
from pathlib import Path

from samquant.api.models import BacktestRequest
from samquant.api.service import run_request

OUTPUT_PATH = Path("web/src/data/demo-backtest.json")
STRATEGY_OUTPUT_PATH = Path("web/src/data/demo-strategies.json")


def main() -> None:
    """Write an actual SamQuant run without requiring network access."""
    request = BacktestRequest(
        symbols=["AAPL"],
        start="2023-01-03",
        end="2024-01-03",
        parameters={"short_window": 20, "long_window": 60},
    )
    report = run_request(request, request_id="demo-v1", allow_yahoo=False)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(report, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    strategy_reports = {}
    for strategy, parameters in (
        ("moving_average", {"short_window": 20, "long_window": 60}),
        (
            "mean_reversion",
            {"lookback_window": 20, "entry_z_score": -1.5, "exit_z_score": 0},
        ),
        (
            "momentum",
            {"lookback_window": 60, "top_n": 1, "rebalance_frequency": 21},
        ),
    ):
        strategy_request = BacktestRequest(
            symbols=["AAPL"],
            start="2023-01-03",
            end="2024-01-03",
            strategy=strategy,
            parameters=parameters,
        )
        strategy_report = run_request(
            strategy_request,
            request_id=f"demo-{strategy}",
            allow_yahoo=False,
        )
        strategy_reports[strategy] = {
            "strategyLabel": strategy_report["metadata"]["strategyLabel"],
            "indicators": strategy_report["indicators"],
            "signals": strategy_report["signals"],
            "metrics": strategy_report["metrics"],
        }
    STRATEGY_OUTPUT_PATH.write_text(
        json.dumps(strategy_reports, indent=2, sort_keys=True),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
