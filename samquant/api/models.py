"""Validated HTTP request models for the SamQuant research API."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from typing import Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator


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


class SizingMethod(str, Enum):
    """Position-sizing choices exposed by the research API."""

    PERCENTAGE = "percentage"
    FIXED_DOLLAR = "fixed_dollar"
    FIXED_SHARES = "fixed_shares"


class StrategyParameters(BaseModel):
    """Bounded parameters for all supported strategy families."""

    short_window: StrictInt = Field(default=20, ge=2, le=500)
    long_window: StrictInt = Field(default=60, ge=3, le=750)
    lookback_window: StrictInt = Field(default=20, ge=2, le=750)
    entry_z_score: float = Field(default=-1.5, ge=-10.0, le=0.0)
    exit_z_score: float = Field(default=0.0, ge=-5.0, le=10.0)
    top_n: StrictInt = Field(default=1, ge=1, le=6)
    rebalance_frequency: StrictInt = Field(default=21, ge=1, le=252)
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
    periods_per_year: StrictInt = Field(default=252, ge=1, le=366)
    risk_free_rate: float = Field(default=0.0, gt=-1.0, le=1.0)
    sizing_method: SizingMethod = SizingMethod.PERCENTAGE
    position_size: float = Field(default=1.0, gt=0.0, le=1_000_000_000.0)
    stop_loss: Optional[float] = Field(default=None, gt=0.0, le=10.0)
    take_profit: Optional[float] = Field(default=None, gt=0.0, le=10.0)
    max_position_allocation: float = Field(default=1.0, gt=0.0, le=1.0)
    max_portfolio_exposure: float = Field(default=1.0, gt=0.0, le=1.0)
    monte_carlo_horizon: StrictInt = Field(default=252, ge=20, le=756)
    monte_carlo_simulations: StrictInt = Field(default=250, ge=50, le=1_000)
    monte_carlo_seed: StrictInt = Field(default=42, ge=0, le=4_294_967_295)

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, symbols: list[str]) -> list[str]:
        """Reject blank or unusually long symbol input before provider access."""
        cleaned = [symbol.strip() for symbol in symbols]
        if any(not symbol for symbol in cleaned):
            raise ValueError("Ticker symbols cannot be blank.")
        if any(len(symbol) > 20 for symbol in cleaned):
            raise ValueError("Ticker symbols must contain at most 20 characters.")
        if len({symbol.upper() for symbol in cleaned}) != len(cleaned):
            raise ValueError("Ticker symbols must be unique.")
        return cleaned

    @model_validator(mode="after")
    def validate_related_fields(self) -> BacktestRequest:
        """Validate date and strategy relationships that span multiple fields."""
        if self.end <= self.start:
            raise ValueError("End date must be later than start date.")
        latest_session = latest_completed_session_date(self.market)
        if self.end > latest_session:
            raise ValueError(
                f"End date cannot be later than the latest allowed market date, {latest_session.isoformat()}."
            )
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
        if self.sizing_method is SizingMethod.PERCENTAGE and self.position_size > 1.0:
            raise ValueError("Percentage position size cannot exceed 1.0.")
        if self.max_position_allocation > self.max_portfolio_exposure:
            raise ValueError(
                "Maximum position allocation cannot exceed portfolio exposure."
            )
        return self


def latest_completed_session_date(
    market: Market,
    now: datetime | None = None,
) -> date:
    """Return the latest eligible weekday after the regular market close."""
    schedules = {
        Market.US: (ZoneInfo("America/New_York"), time(16, 0)),
        Market.INDIA_NSE: (ZoneInfo("Asia/Kolkata"), time(15, 30)),
        Market.INDIA_BSE: (ZoneInfo("Asia/Kolkata"), time(15, 30)),
    }
    zone, close_time = schedules[market]
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    local = current.astimezone(zone)
    candidate = local.date()
    if local.weekday() >= 5 or local.time() < close_time:
        candidate -= timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate -= timedelta(days=1)
    return candidate
