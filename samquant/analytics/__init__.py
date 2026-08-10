"""Public performance and risk analytics."""

from samquant.analytics.metrics import (
    AnalyticsError,
    PerformanceMetrics,
    annualized_return,
    annualized_volatility,
    calculate_metrics,
    maximum_drawdown,
    sharpe_ratio,
    total_return,
    trade_win_rate,
)
from samquant.analytics.monte_carlo import (
    MonteCarloError,
    MonteCarloResult,
    simulate_portfolio,
)
from samquant.analytics.portfolio import (
    PortfolioAnalysis,
    PortfolioAnalysisError,
    analyze_portfolio,
)

__all__ = [
    "AnalyticsError",
    "PerformanceMetrics",
    "annualized_return",
    "annualized_volatility",
    "calculate_metrics",
    "maximum_drawdown",
    "sharpe_ratio",
    "total_return",
    "trade_win_rate",
    "MonteCarloError",
    "MonteCarloResult",
    "simulate_portfolio",
    "PortfolioAnalysis",
    "PortfolioAnalysisError",
    "analyze_portfolio",
]
