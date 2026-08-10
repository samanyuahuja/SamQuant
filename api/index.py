"""Vercel serverless entry point for the SamQuant FastAPI service."""

import os
import sys
from pathlib import Path

import yfinance as yf

project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

if os.getenv("VERCEL"):
    runtime_root = Path("/tmp/samquant")
    runtime_root.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(runtime_root / "yfinance"))
    os.chdir(runtime_root)

from samquant.api.app import app

__all__ = ["app"]
