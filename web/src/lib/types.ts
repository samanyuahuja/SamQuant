export type DataSource = "demo" | "yahoo";
export type Market = "US" | "India (NSE)" | "India (BSE)";
export type StrategyId = "moving_average" | "mean_reversion" | "momentum";

export interface StrategyParameters {
  short_window: number;
  long_window: number;
  lookback_window: number;
  entry_z_score: number;
  exit_z_score: number;
  top_n: number;
  rebalance_frequency: number;
  require_positive_returns: boolean;
}

export interface BacktestRequest {
  data_source: DataSource;
  market: Market;
  symbols: string[];
  start: string;
  end: string;
  strategy: StrategyId;
  parameters: StrategyParameters;
  initial_cash: number;
  commission_rate: number;
  fixed_fee: number;
  slippage_bps: number;
  periods_per_year: number;
  risk_free_rate: number;
}

export interface TimeValue {
  time: string;
  value: number | null;
}

export interface MarketBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalRecord {
  time: string;
  symbol: string;
  side: "BUY" | "SELL";
  targetWeight: number;
}

export interface TradeRecord {
  time: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  notional: number;
  fee: number;
  cashEffect: number;
}

export interface MetricValues {
  totalReturn: number | null;
  annualizedReturn: number | null;
  annualizedVolatility: number | null;
  sharpeRatio: number | null;
  maximumDrawdown: number | null;
  winRate: number | null;
  finalValue: number;
  tradeCount: number;
}

export interface BacktestResponse {
  metadata: {
    requestId: string;
    version: string;
    dataSource: DataSource;
    market: Market;
    symbols: string[];
    start: string;
    end: string;
    strategy: StrategyId;
    strategyLabel: string;
    parameters: Record<string, number | boolean>;
  };
  market: Record<string, MarketBar[]>;
  indicators: Record<string, Record<string, TimeValue[]>>;
  signals: SignalRecord[];
  portfolio: {
    equity: TimeValue[];
    benchmark: TimeValue[];
    drawdown: TimeValue[];
    cash: TimeValue[];
    positions: Record<string, TimeValue[]>;
  };
  metrics: MetricValues;
  benchmarkMetrics: MetricValues;
  trades: TradeRecord[];
  assumptions: Record<string, string>;
  warnings: string[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields: string[];
    requestId: string;
  };
}

export const DEFAULT_REQUEST: BacktestRequest = {
  data_source: "demo",
  market: "US",
  symbols: ["AAPL"],
  start: "2023-01-03",
  end: "2024-01-03",
  strategy: "moving_average",
  parameters: {
    short_window: 20,
    long_window: 60,
    lookback_window: 20,
    entry_z_score: -1.5,
    exit_z_score: 0,
    top_n: 1,
    rebalance_frequency: 21,
    require_positive_returns: true,
  },
  initial_cash: 100_000,
  commission_rate: 0.001,
  fixed_fee: 0,
  slippage_bps: 5,
  periods_per_year: 252,
  risk_free_rate: 0,
};
