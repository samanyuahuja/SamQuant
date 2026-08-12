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
from samquant.api.security import SlidingWindowLimiter, valid_internal_key
from samquant.application import MARKET_NAMES, STRATEGY_NAMES, ResearchError


def create_app(
    *,
    allow_yahoo: bool | None = None,
    internal_key: str | None = None,
) -> FastAPI:
    """Build the HTTP app with explicit data-source policy."""
    production = os.getenv("ENVIRONMENT", "").strip().lower() == "production"
    yahoo_enabled = allow_yahoo if allow_yahoo is not None else (
        _environment_flag("SAMQUANT_ENABLE_YAHOO")
        and _environment_flag("SAMQUANT_DATA_PROVIDER_APPROVED")
    )
    expected_internal_key = internal_key or os.getenv("SAMQUANT_INTERNAL_API_KEY")
    if production and not expected_internal_key:
        raise RuntimeError("SAMQUANT_INTERNAL_API_KEY is required in production")
    if production and not _environment_flag("SAMQUANT_RESEARCH_ONLY"):
        raise RuntimeError("SAMQUANT_RESEARCH_ONLY must be enabled in production")
    limiter = SlidingWindowLimiter(
        requests=max(1, min(int(os.getenv("SAMQUANT_BACKTESTS_PER_MINUTE", "10")), 30)),
        window_seconds=60,
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

    @api.middleware("http")
    async def protect_research_engine(request: Request, call_next: Any) -> Any:
        if request.url.path != "/api/v1/backtests":
            return await call_next(request)
        if expected_internal_key and not valid_internal_key(
            request.headers.get("x-samquant-internal-key"), expected_internal_key
        ):
            return _error_response(
                request,
                status=401,
                code="PRIVATE_API",
                message="This research engine accepts requests only through the SamQuant web application.",
            )
        caller = request.headers.get("x-forwarded-for", "unknown").split(",", 1)[0].strip()
        allowed, retry_after = limiter.allow(caller)
        if not allowed:
            response = _error_response(
                request,
                status=429,
                code="RATE_LIMITED",
                message="The research request limit has been reached. Try again shortly.",
            )
            response.headers["retry-after"] = str(retry_after)
            return response
        return await call_next(request)

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
        return {"status": "ok", "service": "samquant", "mode": "historical-research"}

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
