"""Smoke tests for the initial SamQuant package structure."""

from __future__ import annotations

import importlib


def test_core_modules_are_importable() -> None:
    """The Phase 1 scaffold should expose importable Python modules."""
    modules = [
        "quantlab",
        "quantlab.data.market_data",
        "quantlab.engine.backtester",
        "quantlab.engine.order",
        "quantlab.engine.portfolio",
        "quantlab.strategies.moving_average",
        "quantlab.strategies.momentum",
        "quantlab.strategies.mean_reversion",
        "quantlab.analytics.metrics",
    ]

    for module in modules:
        importlib.import_module(module)

