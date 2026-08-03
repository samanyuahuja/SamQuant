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
import { explainResults } from "@/lib/explain-results";
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
  const [symbolsInput, setSymbolsInput] = useState(DEFAULT_REQUEST.symbols.join(", "));
  const [inputRevision, setInputRevision] = useState(0);
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
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
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
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
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
    setSymbolsInput(DEFAULT_REQUEST.symbols.join(", "));
    setInputRevision((current) => current + 1);
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
            <p>{formatDate(report.metadata.start)} to {formatDate(report.metadata.end)} · {report.metadata.market} · {sourceLabel(report.metadata.dataSource)}</p>
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
            <form key={inputRevision} id="backtest-form" onSubmit={handleSubmit}>
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
                        const symbols = MARKET_DEFAULTS[market];
                        setSymbolsInput(symbols.join(", "));
                        setRequest((current) => ({ ...current, market, symbols }));
                      }}
                    >
                      {Object.keys(MARKET_DEFAULTS).map((market) => <option key={market}>{market}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Tickers" htmlFor="symbols" hint="Separate up to six tickers with commas.">
                    <input
                      id="symbols"
                      aria-invalid={errorFields.includes("symbols")}
                      aria-describedby="symbols-hint"
                      value={symbolsInput}
                      onChange={(event) => {
                        setSymbolsInput(event.target.value);
                        updateRequest("symbols", parseTickerInput(event.target.value));
                      }}
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
                  <StrategyFields key={request.strategy} request={request} update={updateParameter} errorFields={errorFields} />
                </fieldset>

                <fieldset>
                  <legend>Execution</legend>
                  <FormField label={`Starting cash (${inputCurrency})`} htmlFor="initial-cash">
                    <NumberInput id="initial-cash" min={1} step={1} value={request.initial_cash} onValueChange={(value) => updateRequest("initial_cash", value)} />
                  </FormField>
                  <div className={styles.twoColumns}>
                    <FormField label="Commission (%)" htmlFor="commission">
                      <NumberInput id="commission" min={0} max={5} step={0.01} value={request.commission_rate * 100} onValueChange={(value) => updateRequest("commission_rate", value / 100)} />
                    </FormField>
                    <FormField label="Slippage (bps)" htmlFor="slippage">
                      <NumberInput id="slippage" min={0} max={9999} step={1} value={request.slippage_bps} onValueChange={(value) => updateRequest("slippage_bps", value)} />
                    </FormField>
                  </div>
                  <FormField label={`Fixed fee (${inputCurrency})`} htmlFor="fixed-fee">
                    <NumberInput id="fixed-fee" min={0} step={0.01} value={request.fixed_fee} onValueChange={(value) => updateRequest("fixed_fee", value)} />
                  </FormField>
                  <details className={styles.advanced}>
                    <summary>Analytics setting</summary>
                    <FormField label="Risk-free rate (%)" htmlFor="risk-free-rate">
                      <NumberInput id="risk-free-rate" min={-99} max={100} step={0.1} value={request.risk_free_rate * 100} onValueChange={(value) => updateRequest("risk_free_rate", value / 100)} />
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

        <PlainEnglishResult report={report} currency={resultCurrency} />

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

function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.formField}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small id={`${htmlFor}-hint`}>{hint}</small>}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onValueChange,
  ariaInvalid = false,
  min,
  max,
  step,
}: {
  id: string;
  value: number;
  onValueChange: (value: number) => void;
  ariaInvalid?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));

  return (
    <input
      id={id}
      type="number"
      required
      min={min}
      max={max}
      step={step}
      value={draft}
      aria-invalid={ariaInvalid || undefined}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        if (nextDraft === "") return;
        const nextValue = Number(nextDraft);
        if (Number.isFinite(nextValue)) onValueChange(nextValue);
      }}
    />
  );
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
      <FormField label="Short window" htmlFor="short-window"><NumberInput id="short-window" ariaInvalid={errorFields.includes("short_window")} min={2} max={500} value={parameters.short_window} onValueChange={(value) => update("short_window", value)} /></FormField>
      <FormField label="Long window" htmlFor="long-window"><NumberInput id="long-window" ariaInvalid={errorFields.includes("long_window")} min={3} max={750} value={parameters.long_window} onValueChange={(value) => update("long_window", value)} /></FormField>
    </div>;
  }
  if (request.strategy === "mean_reversion") {
    return <>
      <FormField label="Lookback window" htmlFor="lookback-window"><NumberInput id="lookback-window" min={2} max={750} value={parameters.lookback_window} onValueChange={(value) => update("lookback_window", value)} /></FormField>
      <div className={styles.twoColumns}>
        <FormField label="Entry z-score" htmlFor="entry-z"><NumberInput id="entry-z" min={-10} max={0} step={0.1} value={parameters.entry_z_score} onValueChange={(value) => update("entry_z_score", value)} /></FormField>
        <FormField label="Exit z-score" htmlFor="exit-z"><NumberInput id="exit-z" min={-5} max={10} step={0.1} value={parameters.exit_z_score} onValueChange={(value) => update("exit_z_score", value)} /></FormField>
      </div>
    </>;
  }
  return <>
    <div className={styles.twoColumns}>
      <FormField label="Lookback" htmlFor="momentum-lookback"><NumberInput id="momentum-lookback" min={2} max={750} value={parameters.lookback_window} onValueChange={(value) => update("lookback_window", value)} /></FormField>
      <FormField label="Top assets" htmlFor="top-assets"><NumberInput id="top-assets" min={1} max={6} value={parameters.top_n} onValueChange={(value) => update("top_n", value)} /></FormField>
    </div>
    <FormField label="Rebalance frequency" htmlFor="rebalance-frequency"><NumberInput id="rebalance-frequency" min={1} max={252} value={parameters.rebalance_frequency} onValueChange={(value) => update("rebalance_frequency", value)} /></FormField>
    <label className={styles.checkbox}><input type="checkbox" checked={parameters.require_positive_returns} onChange={(event) => update("require_positive_returns", event.target.checked)} /><span>Require positive trailing returns</span></label>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}<Link href="/methodology" title={`${label} methodology`} aria-label={`Read ${label} methodology`}><Info size={12} /></Link></span><strong>{value}</strong></div>;
}

function PlainEnglishResult({ report, currency }: { report: BacktestResponse; currency: string }) {
  const explanation = explainResults(report, currency);
  return (
    <section className={styles.explanation} aria-labelledby="result-explanation-heading">
      <header className={styles.explanationHeader}>
        <div>
          <span>Plain-English result</span>
          <h2 id="result-explanation-heading">What happened in this backtest?</h2>
        </div>
        <strong data-tone={explanation.tone}>{explanation.status}</strong>
      </header>

      <p className={styles.explanationLead}>{explanation.outcome}</p>

      <div className={styles.explanationLessons}>
        <article>
          <span>Compared with holding</span>
          <h3>Did the rules help?</h3>
          <p>{explanation.comparison}</p>
        </article>
        <article>
          <span>Risk</span>
          <h3>How rough was the ride?</h3>
          <p>{explanation.risk}</p>
        </article>
        <article>
          <span>Evidence</span>
          <h3>How much can we learn?</h3>
          <p>{explanation.evidence}</p>
        </article>
      </div>

      <div className={styles.explanationAnswers}>
        <article>
          <span>Buy or sell?</span>
          <h3>{explanation.decisionTitle}</h3>
          <p>{explanation.decisionBody}</p>
        </article>
        <article>
          <span>Future prediction</span>
          <h3>{explanation.futureTitle}</h3>
          <p>{explanation.futureBody}</p>
        </article>
      </div>
    </section>
  );
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
  return `${symbols} with ${strategy.toLowerCase()}, ${formatDate(request.start)} to ${formatDate(request.end)}`;
}

function parseTickerInput(value: string): string[] {
  return value.split(/[,\n]+/).map((symbol) => symbol.trim()).filter(Boolean);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function sourceLabel(source: BacktestResponse["metadata"]["dataSource"]): string {
  return source === "demo" ? "Demo data" : "Yahoo Finance";
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
  if (request.symbols.length > 6) return { message: "Enter no more than six ticker symbols.", fields: ["symbols"] };
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
