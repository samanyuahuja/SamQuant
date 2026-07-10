"""Market data download, validation, and local storage utilities.

This module is intentionally small and functional. The backtesting engine should
receive clean historical OHLCV data, not know how data was downloaded or stored.
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

import pandas as pd
import yfinance as yf

OHLCV_COLUMNS: Final[tuple[str, ...]] = ("Open", "High", "Low", "Close", "Volume")
OPTIONAL_COLUMNS: Final[tuple[str, ...]] = ("Adj Close",)
DEFAULT_DATA_DIR: Final[Path] = Path("data/raw")


class MarketDataError(ValueError):
    """Raised when market data is missing, malformed, or internally inconsistent."""


def download_ohlcv(
    symbol: str,
    start: str,
    end: str,
    interval: str = "1d",
    auto_adjust: bool = False,
) -> pd.DataFrame:
    """Download historical OHLCV data for one symbol from Yahoo Finance.

    The returned frame is indexed by timestamp and contains at least Open, High,
    Low, Close, and Volume columns. `end` follows yfinance's convention: it is
    exclusive for daily data.
    """
    cleaned_symbol = normalize_symbol(symbol)
    data = yf.download(
        cleaned_symbol,
        start=start,
        end=end,
        interval=interval,
        auto_adjust=auto_adjust,
        progress=False,
        group_by="column",
    )

    normalized = normalize_ohlcv_frame(data)
    validate_ohlcv(normalized)
    return normalized


def get_ohlcv(
    symbol: str,
    start: str,
    end: str,
    interval: str = "1d",
    data_dir: Path | str = DEFAULT_DATA_DIR,
    refresh: bool = False,
) -> pd.DataFrame:
    """Load OHLCV data from disk, or download and cache it when missing.

    Set `refresh=True` to force a new download. The cached file name includes the
    symbol, start date, end date, and interval so separate research windows do
    not overwrite one another.
    """
    path = build_data_path(symbol, start, end, interval, data_dir)
    if path.exists() and not refresh:
        return load_ohlcv(path)

    data = download_ohlcv(symbol=symbol, start=start, end=end, interval=interval)
    save_ohlcv(data, path)
    return data


def validate_ohlcv(data: pd.DataFrame) -> None:
    """Validate that a DataFrame is safe to pass into strategy and engine code."""
    if data.empty:
        raise MarketDataError("OHLCV data is empty.")

    missing_columns = [column for column in OHLCV_COLUMNS if column not in data.columns]
    if missing_columns:
        raise MarketDataError(f"Missing required OHLCV columns: {missing_columns}.")

    if not isinstance(data.index, pd.DatetimeIndex):
        raise MarketDataError("OHLCV data must use a DatetimeIndex.")

    if data.index.has_duplicates:
        raise MarketDataError("OHLCV data contains duplicate timestamps.")

    if not data.index.is_monotonic_increasing:
        raise MarketDataError("OHLCV timestamps must be sorted in increasing order.")

    required = data.loc[:, list(OHLCV_COLUMNS)]
    if required.isnull().any().any():
        raise MarketDataError("OHLCV data contains missing values.")

    for column in OHLCV_COLUMNS:
        if not pd.api.types.is_numeric_dtype(required[column]):
            raise MarketDataError(f"{column} must be numeric.")

    price_columns = ["Open", "High", "Low", "Close"]
    if (required.loc[:, price_columns] <= 0).any().any():
        raise MarketDataError("Open, High, Low, and Close prices must be positive.")

    if (required["Volume"] < 0).any():
        raise MarketDataError("Volume cannot be negative.")

    if (required["High"] < required[["Open", "Low", "Close"]].max(axis=1)).any():
        raise MarketDataError("High must be greater than or equal to Open, Low, and Close.")

    if (required["Low"] > required[["Open", "High", "Close"]].min(axis=1)).any():
        raise MarketDataError("Low must be less than or equal to Open, High, and Close.")


def save_ohlcv(data: pd.DataFrame, path: Path | str) -> Path:
    """Validate and save OHLCV data to CSV."""
    validate_ohlcv(data)
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data.to_csv(output_path, index_label="Date")
    return output_path


def load_ohlcv(path: Path | str) -> pd.DataFrame:
    """Load OHLCV data from CSV and validate it before returning."""
    input_path = Path(path)
    if not input_path.exists():
        raise FileNotFoundError(f"Market data file does not exist: {input_path}")

    data = pd.read_csv(input_path, parse_dates=["Date"], index_col="Date")
    data = normalize_ohlcv_frame(data)
    validate_ohlcv(data)
    return data


def normalize_ohlcv_frame(data: pd.DataFrame) -> pd.DataFrame:
    """Normalize provider output into SamQuant's expected OHLCV schema."""
    if data.empty:
        return data.copy()

    normalized = data.copy()
    if isinstance(normalized.columns, pd.MultiIndex):
        normalized.columns = _flatten_yfinance_columns(normalized.columns)

    expected_columns = (*OHLCV_COLUMNS, *OPTIONAL_COLUMNS)
    keep_columns = [column for column in expected_columns if column in normalized.columns]
    normalized = normalized.loc[:, keep_columns]
    normalized = normalized.sort_index()

    if normalized.index.name is None:
        normalized.index.name = "Date"

    return normalized


def build_data_path(
    symbol: str,
    start: str,
    end: str,
    interval: str = "1d",
    data_dir: Path | str = DEFAULT_DATA_DIR,
) -> Path:
    """Build the deterministic CSV path for a cached OHLCV data request."""
    safe_symbol = normalize_symbol(symbol).replace("/", "-")
    file_name = f"{safe_symbol}_{start}_{end}_{interval}.csv"
    return Path(data_dir) / "ohlcv" / file_name


def normalize_symbol(symbol: str) -> str:
    """Return a normalized ticker symbol suitable for provider requests and paths."""
    cleaned = symbol.strip().upper()
    if not cleaned:
        raise MarketDataError("Symbol cannot be empty.")
    return cleaned


def _flatten_yfinance_columns(columns: pd.MultiIndex) -> list[str]:
    """Flatten yfinance MultiIndex columns for single-symbol downloads."""
    flattened: list[str] = []
    known_columns = set(OHLCV_COLUMNS).union(OPTIONAL_COLUMNS)

    for column in columns:
        known_parts = [part for part in column if isinstance(part, str) and part in known_columns]
        fallback_name = "_".join(str(part) for part in column if part)
        flattened.append(known_parts[0] if known_parts else fallback_name)

    return flattened
