"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CandlestickChart,
  ChevronDown,
  Download,
  Info,
  LineChart,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Table2,
  Waves,
} from "lucide-react";

import { ResearchApiError, runBacktest } from "@/lib/api";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import {
  DEFAULT_REQUEST,
  type BacktestRequest,
  type BacktestResponse,
  type Market,
  type StrategyId,
} from "@/lib/types";
import styles from "./research-terminal.module.css";

const FinancialChart = dynamic(
  () => import("@/components/financial-chart").then((module) => module.FinancialChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

type ResultTab = "performance" | "drawdown" | "trades" | "comparison";

const MARKET_DEFAULTS: Record<Market, string[]> = {
  US: ["AAPL"],
  "India (NSE)": ["RELIANCE"],
  "India (BSE)": ["RELIANCE"],
};

const STRATEGIES: { id: StrategyId; label: string }[] = [
  { id: "moving_average", label: "Moving average" },
  { id: "mean_reversion", label: "Mean reversion" },
  { id: "momentum", label: "Momentum" },
];

const TABS: { id: ResultTab; label: string; icon: React.ReactNode }[] = [
  { id: "performance", label: "Performance", icon: <LineChart size={15} /> },
  { id: "drawdown", label: "Drawdown", icon: <Waves size={15} /> },
  { id: "trades", label: "Trades", icon: <Table2 size={15} /> },
  { id: "comparison", label: "Comparison", icon: <CandlestickChart size={15} /> },
];

const subscribeToHydration = () => () => undefined;

export function ResearchTerminal({ initialReport }: { initialReport: BacktestResponse }) {
  const [request, setRequest] = useState<BacktestRequest>(DEFAULT_REQUEST);
  const [report, setReport] = useState<BacktestResponse>(initialReport);
  const [activeTab, setActiveTab] = useState<ResultTab>("performance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateRequest(request);
    if (validation) {
      setError(validation.message);
      setErrorFields(validation.fields);
      focusFirstField(validation.fields);
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    setErrorFields([]);
    try {
      const nextReport = await runBacktest(request, controller.signal);
      setReport(nextReport);
      setControlsOpen(false);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "The backtest could not be completed.");
      if (caught instanceof ResearchApiError) {
        setErrorFields(caught.fields);
        if (caught.fields.length) focusFirstField(caught.fields);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function updateRequest<K extends keyof BacktestRequest>(key: K, value: BacktestRequest[K]) {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  function updateParameter(key: keyof BacktestRequest["parameters"], value: number | boolean) {
    setRequest((current) => ({
      ...current,
      parameters: { ...current.parameters, [key]: value },
    }));
  }

  function reset() {
    activeRequest.current?.abort();
    setRequest(DEFAULT_REQUEST);
    setReport(initialReport);
    setError(null);
    setErrorFields([]);
    setLoading(false);
    setControlsOpen(false);
  }

  const inputCurrency = request.market === "US" ? "USD" : "INR";
  const resultCurrency = report.metadata.market === "US" ? "USD" : "INR";
  const symbol = report.metadata.symbols[0];
  return (
    <main id="main-content" className={styles.main} data-ready={ready} data-route="research">
      <section className={styles.workspace} aria-live="polite" aria-busy={loading}>
        <header className={styles.workspaceHeader}>
          <div>
            <p className={styles.contextLine}>Backtest research / {report.metadata.symbols.join(" + ")}</p>
            <h1>{report.metadata.strategyLabel}</h1>
            <p>{report.metadata.start} to {report.metadata.end} · {report.metadata.market} · {report.metadata.dataSource} data</p>
          </div>
          <details className={styles.exportMenu}>
            <summary title="Export results">
              <Download aria-hidden="true" size={18} />
              <span className={styles.visuallyHidden}>Export results</span>
            </summary>
            <div>
              <button type="button" onClick={() => downloadJson(report)}>JSON report</button>
              <button type="button" onClick={() => downloadTrades(report)}>Trades CSV</button>
            </div>
          </details>
        </header>

        <section className={styles.experiment} aria-labelledby="experiment-title">
          <header className={styles.experimentHeader}>
            <div>
              <h2 id="experiment-title">Experiment setup</h2>
              <p>{requestSummary(request)}</p>
            </div>
            <div className={styles.experimentActions}>
              <button className={styles.setupButton} type="button" aria-expanded={controlsOpen} aria-controls="backtest-control-body" onClick={() => setControlsOpen((current) => !current)}>
                <SlidersHorizontal aria-hidden="true" size={16} />{controlsOpen ? "Close setup" : "Edit setup"}
              </button>
              <button className={styles.iconButton} type="button" onClick={reset} title="Reset controls" aria-label="Reset controls"><RotateCcw aria-hidden="true" size={17} /></button>
              <button className={styles.runButton} type="submit" form="backtest-form" disabled={!ready || loading}>
                <Play aria-hidden="true" size={15} fill="currentColor" />
                {loading ? "Running backtest" : "Run backtest"}
              </button>
            </div>
          </header>

          <div className={styles.executionPath} aria-label="Backtest execution timing">
            <span>Signal at close</span><ArrowRight aria-hidden="true" size={15} />
            <span>Fill at next open</span><ArrowRight aria-hidden="true" size={15} />
            <span>Costs applied</span>
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertTriangle aria-hidden="true" size={18} />
              <div><strong>Backtest not run</strong><span>{error}</span></div>
            </div>
          )}

          <div id="backtest-control-body" className={styles.controlBody} data-open={controlsOpen}>
            <form id="backtest-form" onSubmit={handleSubmit} noValidate>
              <div className={styles.controlGrid}>
                <fieldset>
                  <legend>Market</legend>
                  <FormField label="Source" htmlFor="data-source">
                    <select id="data-source" value={request.data_source} onChange={(event) => updateRequest("data_source", event.target.value as BacktestRequest["data_source"])}>
                      <option value="demo">Deterministic demo</option>
                      <option value="yahoo">Yahoo Finance (local)</option>
                    </select>
                  </FormField>
                  <FormField label="Market" htmlFor="market">
                    <select
                      id="market"
                      value={request.market}
                      onChange={(event) => {
                        const market = event.target.value as Market;
                        setRequest((current) => ({ ...current, market, symbols: MARKET_DEFAULTS[market] }));
                      }}
                    >
                      {Object.keys(MARKET_DEFAULTS).map((market) => <option key={market}>{market}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Tickers" htmlFor="symbols">
                    <input
                      id="symbols"
                      aria-invalid={errorFields.includes("symbols")}
                      value={request.symbols.join(", ")}
                      onChange={(event) => updateRequest("symbols", event.target.value.split(",").map((symbol) => symbol.trim()).filter(Boolean))}
                      placeholder="AAPL, MSFT"
                    />
                  </FormField>
                  <div className={styles.twoColumns}>
                    <FormField label="Start" htmlFor="start">
                      <input id="start" type="date" aria-invalid={errorFields.includes("start")} value={request.start} onChange={(event) => updateRequest("start", event.target.value)} />
                    </FormField>
                    <FormField label="End" htmlFor="end">
                      <input id="end" type="date" aria-invalid={errorFields.includes("end")} value={request.end} onChange={(event) => updateRequest("end", event.target.value)} />
                    </FormField>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Strategy</legend>
                  <FormField label="Model" htmlFor="strategy">
                    <select id="strategy" value={request.strategy} onChange={(event) => updateRequest("strategy", event.target.value as StrategyId)}>
                      {STRATEGIES.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.label}</option>)}
                    </select>
                  </FormField>
                  <StrategyFields request={request} update={updateParameter} errorFields={errorFields} />
                </fieldset>

                <fieldset>
                  <legend>Execution</legend>
                  <FormField label={`Starting cash (${inputCurrency})`} htmlFor="initial-cash">
                    <input id="initial-cash" type="number" min="1" step="1000" value={request.initial_cash} onChange={(event) => updateRequest("initial_cash", Number(event.target.value))} />
                  </FormField>
                  <div className={styles.twoColumns}>
                    <FormField label="Commission (%)" htmlFor="commission">
                      <input id="commission" type="number" min="0" max="5" step="0.01" value={request.commission_rate * 100} onChange={(event) => updateRequest("commission_rate", Number(event.target.value) / 100)} />
                    </FormField>
                    <FormField label="Slippage (bps)" htmlFor="slippage">
                      <input id="slippage" type="number" min="0" max="9999" step="1" value={request.slippage_bps} onChange={(event) => updateRequest("slippage_bps", Number(event.target.value))} />
                    </FormField>
                  </div>
                  <FormField label={`Fixed fee (${inputCurrency})`} htmlFor="fixed-fee">
                    <input id="fixed-fee" type="number" min="0" step="0.01" value={request.fixed_fee} onChange={(event) => updateRequest("fixed_fee", Number(event.target.value))} />
                  </FormField>
                  <details className={styles.advanced}>
                    <summary>Analytics setting</summary>
                    <FormField label="Risk-free rate (%)" htmlFor="risk-free-rate">
                      <input id="risk-free-rate" type="number" min="-99" max="100" step="0.1" value={request.risk_free_rate * 100} onChange={(event) => updateRequest("risk_free_rate", Number(event.target.value) / 100)} />
                    </FormField>
                  </details>
                </fieldset>
              </div>
            </form>
          </div>
        </section>

        <div className={styles.disclaimer} role="note">
          <Info aria-hidden="true" size={15} />
          <span>Results are hypothetical and depend on the data and assumptions shown here. They are not investment advice or a promise of future performance.</span>
          <Link href="/disclaimer">Read disclaimer</Link>
        </div>

        <section className={styles.pricePanel} aria-labelledby="price-heading">
          <div className={styles.panelHeader}>
            <div><span>Price, indicators, and fills</span><h2 id="price-heading">{symbol} daily bars</h2></div>
            <span className={styles.tradeCount}>{report.trades.length} executed trades</span>
          </div>
          <div className={styles.priceChart}><FinancialChart report={report} mode="price" /></div>
          {loading && <LoadingOverlay />}
        </section>

        <PriceDataTable report={report} />

        <section className={styles.metrics} aria-label="Performance metrics">
          <Metric label="Total return" value={formatPercent(report.metrics.totalReturn)} />
          <Metric label="Annualized" value={formatPercent(report.metrics.annualizedReturn)} />
          <Metric label="Volatility" value={formatPercent(report.metrics.annualizedVolatility)} />
          <Metric label="Sharpe ratio" value={formatNumber(report.metrics.sharpeRatio)} />
          <Metric label="Max drawdown" value={formatPercent(report.metrics.maximumDrawdown)} />
          <Metric label="Win rate" value={formatPercent(report.metrics.winRate)} />
          <Metric label="Final value" value={formatMoney(report.metrics.finalValue, resultCurrency)} />
        </section>

        <div className={styles.tabs} role="tablist" aria-label="Research results">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <section className={styles.resultPanel} id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === "trades" ? (
            <TradeTable report={report} currency={resultCurrency} />
          ) : (
            <div className={styles.resultChart}>
              <FinancialChart report={report} mode={activeTab} />
            </div>
          )}
        </section>

        <details className={styles.assumptions}>
          <summary>
            <span><strong>Methodology and assumptions</strong><small>Review the rules behind this result.</small></span>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <dl>
            {Object.entries(report.assumptions).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </details>
      </section>
    </main>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <label className={styles.formField} htmlFor={htmlFor}><span>{label}</span>{children}</label>;
}

function StrategyFields({
  request,
  update,
  errorFields,
}: {
  request: BacktestRequest;
  update: (key: keyof BacktestRequest["parameters"], value: number | boolean) => void;
  errorFields: string[];
}) {
  const parameters = request.parameters;
  if (request.strategy === "moving_average") {
    return <div className={styles.twoColumns}>
      <FormField label="Short window" htmlFor="short-window"><input id="short-window" aria-invalid={errorFields.includes("short_window")} type="number" min="2" max="500" value={parameters.short_window} onChange={(event) => update("short_window", Number(event.target.value))} /></FormField>
      <FormField label="Long window" htmlFor="long-window"><input id="long-window" aria-invalid={errorFields.includes("long_window")} type="number" min="3" max="750" value={parameters.long_window} onChange={(event) => update("long_window", Number(event.target.value))} /></FormField>
    </div>;
  }
  if (request.strategy === "mean_reversion") {
    return <>
      <FormField label="Lookback window" htmlFor="lookback-window"><input id="lookback-window" type="number" min="2" max="750" value={parameters.lookback_window} onChange={(event) => update("lookback_window", Number(event.target.value))} /></FormField>
      <div className={styles.twoColumns}>
        <FormField label="Entry z-score" htmlFor="entry-z"><input id="entry-z" type="number" min="-10" max="0" step="0.1" value={parameters.entry_z_score} onChange={(event) => update("entry_z_score", Number(event.target.value))} /></FormField>
        <FormField label="Exit z-score" htmlFor="exit-z"><input id="exit-z" type="number" min="-5" max="10" step="0.1" value={parameters.exit_z_score} onChange={(event) => update("exit_z_score", Number(event.target.value))} /></FormField>
      </div>
    </>;
  }
  return <>
    <div className={styles.twoColumns}>
      <FormField label="Lookback" htmlFor="momentum-lookback"><input id="momentum-lookback" type="number" min="2" max="750" value={parameters.lookback_window} onChange={(event) => update("lookback_window", Number(event.target.value))} /></FormField>
      <FormField label="Top assets" htmlFor="top-assets"><input id="top-assets" type="number" min="1" max="6" value={parameters.top_n} onChange={(event) => update("top_n", Number(event.target.value))} /></FormField>
    </div>
    <FormField label="Rebalance frequency" htmlFor="rebalance-frequency"><input id="rebalance-frequency" type="number" min="1" max="252" value={parameters.rebalance_frequency} onChange={(event) => update("rebalance_frequency", Number(event.target.value))} /></FormField>
    <label className={styles.checkbox}><input type="checkbox" checked={parameters.require_positive_returns} onChange={(event) => update("require_positive_returns", event.target.checked)} /><span>Require positive trailing returns</span></label>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}<Link href="/methodology" title={`${label} methodology`} aria-label={`Read ${label} methodology`}><Info size={12} /></Link></span><strong>{value}</strong></div>;
}

function TradeTable({ report, currency }: { report: BacktestResponse; currency: string }) {
  if (!report.trades.length) {
    return <div className={styles.emptyState}><Table2 aria-hidden="true" size={24} /><h3>No trades executed</h3><p>The selected strategy held cash for this period.</p></div>;
  }
  return <div className={styles.tableWrap}>
    <table>
      <caption>Executed trades for this backtest</caption>
      <thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Quantity</th><th>Price</th><th>Fee</th><th>Cash effect</th></tr></thead>
      <tbody>{report.trades.map((trade, index) => (
        <tr key={`${trade.time}-${trade.symbol}-${index}`}>
          <td>{trade.time}</td><td>{trade.symbol}</td><td><span data-side={trade.side}>{trade.side}</span></td>
          <td>{formatNumber(trade.quantity, 4)}</td><td>{formatMoney(trade.price, currency)}</td><td>{formatMoney(trade.fee, currency)}</td><td>{formatMoney(trade.cashEffect, currency)}</td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}

function ChartSkeleton() {
  return <div className={styles.chartSkeleton} role="status" aria-label="Loading chart"><i /><i /><i /><i /></div>;
}

function LoadingOverlay() {
  return <div className={styles.loadingOverlay} role="status"><span /><strong>Running the Python research engine</strong></div>;
}

function requestSummary(request: BacktestRequest): string {
  const strategy = STRATEGIES.find((item) => item.id === request.strategy)?.label ?? request.strategy;
  const symbols = request.symbols.length ? request.symbols.join(" + ") : "No tickers";
  return `${symbols} · ${strategy} · ${request.start} to ${request.end}`;
}

function PriceDataTable({ report }: { report: BacktestResponse }) {
  const symbol = report.metadata.symbols[0];
  const bars = report.market[symbol].slice(-20);
  return (
    <details className={styles.chartData}>
      <summary>View recent chart data</summary>
      <div className={styles.tableWrap}>
        <table>
          <caption>Twenty most recent price bars shown in the chart</caption>
          <thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead>
          <tbody>{bars.map((bar) => <tr key={bar.time}><td>{bar.time}</td><td>{formatNumber(bar.open)}</td><td>{formatNumber(bar.high)}</td><td>{formatNumber(bar.low)}</td><td>{formatNumber(bar.close)}</td><td>{formatNumber(bar.volume, 0)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function focusFirstField(fields: string[]) {
  const ids: Record<string, string> = {
    symbols: "symbols", start: "start", end: "end", short_window: "short-window",
    long_window: "long-window", entry_z_score: "entry-z", exit_z_score: "exit-z",
    top_n: "top-assets",
  };
  requestAnimationFrame(() => document.getElementById(ids[fields[0]] ?? fields[0])?.focus());
}

function validateRequest(request: BacktestRequest): { message: string; fields: string[] } | null {
  if (!request.symbols.length) return { message: "Enter at least one ticker symbol.", fields: ["symbols"] };
  if (request.end <= request.start) return { message: "End date must be later than start date.", fields: ["start", "end"] };
  if (request.strategy === "moving_average" && request.parameters.short_window >= request.parameters.long_window) {
    return { message: "Short window must be smaller than long window.", fields: ["short_window", "long_window"] };
  }
  if (request.strategy === "mean_reversion" && request.parameters.entry_z_score >= request.parameters.exit_z_score) {
    return { message: "Entry z-score must be smaller than exit z-score.", fields: ["entry_z_score", "exit_z_score"] };
  }
  if (request.strategy === "momentum" && request.parameters.top_n > request.symbols.length) {
    return { message: "Top assets cannot exceed the ticker count.", fields: ["top_n", "symbols"] };
  }
  return null;
}

function downloadJson(report: BacktestResponse) {
  downloadFile("samquant-result.json", JSON.stringify(report, null, 2), "application/json");
}

function downloadTrades(report: BacktestResponse) {
  const header = ["date", "symbol", "side", "quantity", "price", "notional", "fee", "cash_effect"];
  const rows = report.trades.map((trade) => [trade.time, trade.symbol, trade.side, trade.quantity, trade.price, trade.notional, trade.fee, trade.cashEffect]);
  downloadFile("samquant-trades.csv", [header, ...rows].map((row) => row.join(",")).join("\n"), "text/csv");
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
