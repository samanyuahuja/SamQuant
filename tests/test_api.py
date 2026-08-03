"""Contract tests for the FastAPI research boundary."""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from samquant.api.app import create_app

api_module = importlib.import_module("samquant.api.app")


def _client(*, allow_yahoo: bool = False) -> TestClient:
    return TestClient(create_app(allow_yahoo=allow_yahoo))


def test_health_and_catalog_expose_bounded_capabilities() -> None:
    client = _client()

    assert client.get("/api/v1/health").json() == {
        "status": "ok",
        "service": "samquant",
    }
    catalog = client.get("/api/v1/catalog").json()
    assert catalog["dataSources"] == ["demo"]
    assert catalog["limits"] == {"symbols": 6, "periods": 2_000}


def test_backtest_response_contains_real_domain_outputs() -> None:
    response = _client().post(
        "/api/v1/backtests",
        json={
            "symbols": ["AAPL"],
            "start": "2024-01-02",
            "end": "2024-06-28",
            "parameters": {"short_window": 5, "long_window": 20},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["strategy"] == "moving_average"
    assert body["metadata"]["symbols"] == ["AAPL"]
    assert set(body["indicators"]) == {"short_average", "long_average"}
    assert len(body["market"]["AAPL"]) > 100
    assert body["portfolio"]["equity"]
    assert body["portfolio"]["benchmark"]
    assert body["metrics"]["finalValue"] > 0
    assert response.headers["x-request-id"] == body["metadata"]["requestId"]


def test_api_normalizes_indian_symbols() -> None:
    response = _client().post(
        "/api/v1/backtests",
        json={
            "market": "India (NSE)",
            "symbols": ["RELIANCE"],
            "start": "2024-01-02",
            "end": "2024-06-28",
            "strategy": "mean_reversion",
        },
    )

    assert response.status_code == 200
    assert response.json()["metadata"]["symbols"] == ["RELIANCE.NS"]


def test_invalid_dates_return_structured_field_errors() -> None:
    response = _client().post(
        "/api/v1/backtests",
        json={"start": "2024-02-01", "end": "2024-01-01"},
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "INVALID_REQUEST"
    assert error["requestId"]


def test_disabled_yahoo_source_returns_a_natural_error() -> None:
    response = _client().post(
        "/api/v1/backtests",
        json={
            "data_source": "yahoo",
            "symbols": ["AAPL"],
            "start": "2024-01-02",
            "end": "2024-06-28",
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BACKTEST_INPUT_ERROR"
    assert response.json()["error"]["message"] == (
        "Yahoo Finance is not available on this server. "
        "Use demo data, or enable it in your local API."
    )


def test_unexpected_backend_failure_does_not_expose_a_traceback(monkeypatch) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise RuntimeError("private implementation detail")

    monkeypatch.setattr(api_module, "run_request", fail)
    client = TestClient(create_app(), raise_server_exceptions=False)

    response = client.post("/api/v1/backtests", json={})

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"
    assert "private implementation detail" not in response.text
