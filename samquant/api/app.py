"""FastAPI entry point for the SamQuant web application."""

from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from samquant.api.models import BacktestRequest
from samquant.api.service import run_request
from samquant.application import MARKET_NAMES, STRATEGY_NAMES, ResearchError


def create_app(*, allow_yahoo: bool | None = None) -> FastAPI:
    """Build the HTTP app with explicit data-source policy."""
    yahoo_enabled = (
        _environment_flag("SAMQUANT_ENABLE_YAHOO")
        if allow_yahoo is None
        else allow_yahoo
    )
    api = FastAPI(
        title="SamQuant Research API",
        version="1.0.0",
        description="A thin HTTP boundary over the tested SamQuant Python package.",
    )

    @api.middleware("http")
    async def add_request_id(request: Request, call_next: Any) -> Any:
        request_id = request.headers.get("x-request-id", str(uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    @api.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request,
        exception: RequestValidationError,
    ) -> JSONResponse:
        fields = [
            ".".join(str(part) for part in error["loc"] if part != "body")
            for error in exception.errors()
        ]
        return _error_response(
            request,
            status=422,
            code="INVALID_REQUEST",
            message="Check the highlighted backtest inputs and try again.",
            fields=fields,
        )

    @api.exception_handler(ResearchError)
    async def research_error(
        request: Request, exception: ResearchError
    ) -> JSONResponse:
        return _error_response(
            request,
            status=400,
            code="BACKTEST_INPUT_ERROR",
            message=str(exception),
        )

    @api.exception_handler(Exception)
    async def unexpected_error(request: Request, exception: Exception) -> JSONResponse:
        del exception
        return _error_response(
            request,
            status=500,
            code="INTERNAL_ERROR",
            message="The backtest service could not complete this request.",
        )

    @api.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "samquant"}

    @api.get("/api/v1/catalog")
    def catalog() -> dict[str, Any]:
        return {
            "markets": list(MARKET_NAMES),
            "strategies": list(STRATEGY_NAMES),
            "dataSources": ["demo", *(["yahoo"] if yahoo_enabled else [])],
            "yahooEnabled": yahoo_enabled,
            "limits": {"symbols": 6, "periods": 2_000},
        }

    @api.post("/api/v1/backtests")
    def create_backtest(request: Request, payload: BacktestRequest) -> dict[str, Any]:
        return run_request(
            payload,
            request_id=request.state.request_id,
            allow_yahoo=yahoo_enabled,
        )

    return api


def _error_response(
    request: Request,
    *,
    status: int,
    code: str,
    message: str,
    fields: list[str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "fields": fields or [],
                "requestId": getattr(request.state, "request_id", "unknown"),
            }
        },
    )


def _environment_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes"}


app = create_app()
