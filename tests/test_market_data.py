"""Tests for market data validation and local storage."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from samquant.data.market_data import (
    MarketDataError,
    build_data_path,
    download_ohlcv,
    load_ohlcv,
    normalize_symbol,
    save_ohlcv,
    validate_ohlcv,
)


def _valid_ohlcv() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Open": [100.0, 101.0, 102.0],
            "High": [101.0, 103.0, 104.0],
            "Low": [99.0, 100.0, 101.0],
            "Close": [100.5, 102.5, 103.0],
            "Volume": [1_000_000, 1_100_000, 1_200_000],
        },
        index=pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-04"]),
    ).rename_axis("Date")


def test_validate_ohlcv_accepts_clean_data() -> None:
    validate_ohlcv(_valid_ohlcv())


def test_validate_ohlcv_rejects_missing_required_columns() -> None:
    data = _valid_ohlcv().drop(columns=["Volume"])

    with pytest.raises(MarketDataError, match="Missing required OHLCV columns"):
        validate_ohlcv(data)


def test_validate_ohlcv_rejects_unsorted_index() -> None:
    data = _valid_ohlcv().sort_index(ascending=False)

    with pytest.raises(MarketDataError, match="sorted in increasing order"):
        validate_ohlcv(data)


def test_validate_ohlcv_rejects_invalid_high_low_relationship() -> None:
    data = _valid_ohlcv()
    data.loc[pd.Timestamp("2024-01-03"), "High"] = 99.0

    with pytest.raises(MarketDataError, match="High must be greater"):
        validate_ohlcv(data)


def test_validate_ohlcv_rejects_negative_volume() -> None:
    data = _valid_ohlcv()
    data.loc[pd.Timestamp("2024-01-03"), "Volume"] = -1

    with pytest.raises(MarketDataError, match="Volume cannot be negative"):
        validate_ohlcv(data)


def test_download_ohlcv_drops_incomplete_provider_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider_data = _valid_ohlcv()
    provider_data["Adj Close"] = [100.5, 102.5, float("nan")]
    provider_data.loc[pd.Timestamp("2024-01-03"), "Close"] = float("nan")

    download_arguments: dict[str, object] = {}

    def fake_download(*args: object, **kwargs: object) -> pd.DataFrame:
        download_arguments.update(kwargs)
        return provider_data

    monkeypatch.setattr("samquant.data.market_data.yf.download", fake_download)

    downloaded = download_ohlcv("RELIANCE.NS", "2024-01-01", "2024-02-01")

    assert downloaded.index.tolist() == [
        pd.Timestamp("2024-01-02"),
        pd.Timestamp("2024-01-04"),
    ]
    assert pd.isna(downloaded.loc[pd.Timestamp("2024-01-04"), "Adj Close"])
    assert download_arguments["auto_adjust"] is True
    validate_ohlcv(downloaded)


def test_save_and_load_ohlcv_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "aapl.csv"
    saved_path = save_ohlcv(_valid_ohlcv(), path)

    loaded = load_ohlcv(saved_path)

    pd.testing.assert_frame_equal(loaded, _valid_ohlcv())


def test_build_data_path_is_deterministic_and_symbol_safe(tmp_path: Path) -> None:
    path = build_data_path(" brk/b ", "2024-01-01", "2024-02-01", data_dir=tmp_path)

    assert path == (
        tmp_path / "ohlcv" / "BRK-B_2024-01-01_2024-02-01_1d_adjusted.csv"
    )


def test_build_data_path_separates_adjusted_and_unadjusted_data(tmp_path: Path) -> None:
    adjusted = build_data_path("AAPL", "2024-01-01", "2024-02-01", data_dir=tmp_path)
    unadjusted = build_data_path(
        "AAPL",
        "2024-01-01",
        "2024-02-01",
        data_dir=tmp_path,
        auto_adjust=False,
    )

    assert adjusted != unadjusted
    assert adjusted.name.endswith("_adjusted.csv")
    assert unadjusted.name.endswith("_unadjusted.csv")


def test_build_data_path_rejects_non_boolean_adjustment_setting(tmp_path: Path) -> None:
    with pytest.raises(MarketDataError, match="must be boolean"):
        build_data_path(
            "AAPL",
            "2024-01-01",
            "2024-02-01",
            data_dir=tmp_path,
            auto_adjust=1,  # type: ignore[arg-type]
        )


def test_normalize_symbol_rejects_empty_symbol() -> None:
    with pytest.raises(MarketDataError, match="Symbol cannot be empty"):
        normalize_symbol("   ")
