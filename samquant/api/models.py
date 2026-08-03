"""Validated HTTP request models for the SamQuant research API."""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


class DataSource(str, Enum):
    """Market-data sources exposed by the API."""

    DEMO = "demo"
    YAHOO = "yahoo"


class Market(str, Enum):
    """Supported symbol suffix conventions."""

    US = "US"
    INDIA_NSE = "India (NSE)"
    INDIA_BSE = "India (BSE)"


class StrategyId(str, Enum):
    """Stable identifiers for supported strategies."""

    MOVING_AVERAGE = "moving_average"
    MEAN_REVERSION = "mean_reversion"
    MOMENTUM = "momentum"


class StrategyParameters(BaseModel):
    """Bounded parameters for all supported strategy families."""

    short_window: int = Field(default=20, ge=2, le=500)
    long_window: int = Field(default=60, ge=3, le=750)
    lookback_window: int = Field(default=20, ge=2, le=750)
    entry_z_score: float = Field(default=-1.5, ge=-10.0, le=0.0)
    exit_z_score: float = Field(default=0.0, ge=-5.0, le=10.0)
    top_n: int = Field(default=1, ge=1, le=6)
    rebalance_frequency: int = Field(default=21, ge=1, le=252)
    require_positive_returns: bool = True


class BacktestRequest(BaseModel):
    """Complete user-controlled input for a bounded historical backtest."""

    data_source: DataSource = DataSource.DEMO
    market: Market = Market.US
    symbols: list[str] = Field(
        default_factory=lambda: ["AAPL", "MSFT", "NVDA"],
        min_length=1,
        max_length=6,
    )
    start: date = date(2022, 1, 3)
    end: date = date(2024, 1, 2)
    strategy: StrategyId = StrategyId.MOVING_AVERAGE
    parameters: StrategyParameters = Field(default_factory=StrategyParameters)
    initial_cash: float = Field(default=100_000.0, gt=0.0, le=1_000_000_000.0)
    commission_rate: float = Field(default=0.001, ge=0.0, le=0.05)
    fixed_fee: float = Field(default=0.0, ge=0.0, le=10_000.0)
    slippage_bps: float = Field(default=5.0, ge=0.0, lt=10_000.0)
    periods_per_year: int = Field(default=252, ge=1, le=366)
    risk_free_rate: float = Field(default=0.0, gt=-1.0, le=1.0)

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, symbols: list[str]) -> list[str]:
        """Reject blank or unusually long symbol input before provider access."""
        cleaned = [symbol.strip() for symbol in symbols]
        if any(not symbol for symbol in cleaned):
            raise ValueError("Ticker symbols cannot be blank.")
        if any(len(symbol) > 20 for symbol in cleaned):
            raise ValueError("Ticker symbols must contain at most 20 characters.")
        return cleaned

    @model_validator(mode="after")
    def validate_related_fields(self) -> BacktestRequest:
        """Validate date and strategy relationships that span multiple fields."""
        if self.end <= self.start:
            raise ValueError("End date must be later than start date.")
        if (
            self.strategy is StrategyId.MOVING_AVERAGE
            and self.parameters.short_window >= self.parameters.long_window
        ):
            raise ValueError("Short window must be smaller than long window.")
        if (
            self.strategy is StrategyId.MEAN_REVERSION
            and self.parameters.entry_z_score >= self.parameters.exit_z_score
        ):
            raise ValueError("Entry z-score must be smaller than exit z-score.")
        if self.parameters.top_n > len(self.symbols):
            raise ValueError("Top asset count cannot exceed the symbol count.")
        return self
