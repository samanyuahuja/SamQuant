"""Smoke tests for the initial SamQuant package structure."""

from __future__ import annotations

import importlib


def test_core_modules_are_importable() -> None:
    """The Phase 1 scaffold should expose importable Python modules."""
    modules = [
        "samquant",
        "samquant.data.market_data",
        "samquant.engine.backtester",
        "samquant.engine.order",
        "samquant.engine.portfolio",
        "samquant.strategies.moving_average",
        "samquant.strategies.momentum",
        "samquant.strategies.mean_reversion",
        "samquant.analytics.metrics",
    ]

    for module in modules:
        importlib.import_module(module)
