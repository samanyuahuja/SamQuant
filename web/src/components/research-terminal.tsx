"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { ResearchApiError, runBacktest } from "@/lib/api";
import { calculateAssetAttribution } from "@/lib/asset-attribution";
import { explainResults } from "@/lib/explain-results";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import {
  clearResearchSession,
  isIsoDate,
  latestCompletedMarketDate,
  loadResearchReport,
  loadResearchRequest,
  saveResearchReport,
  saveResearchRequest,
} from "@/lib/research-session";
import {
  DEFAULT_REQUEST,
  type BacktestRequest,
  type BacktestResponse,
  type Market,
  type StrategyStudyTrial,
  type StrategyId,
} from "@/lib/types";
import styles from "./research-terminal.module.css";
import { MonteCarloLab, PortfolioLab } from "./advanced-analysis";

const FinancialChart = dynamic(
  () => import("@/components/financial-chart").then((module) => module.FinancialChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

type ResultTab = "performance" | "drawdown" | "trades" | "comparison" | "study" | "portfolio" | "simulation";

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

const TABS: { id: ResultTab; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "drawdown", label: "Drawdown" },
  { id: "trades", label: "Trades" },
  { id: "comparison", label: "Comparison" },
  { id: "study", label: "Parameter study" },
  { id: "portfolio", label: "Portfolio lab" },
  { id: "simulation", label: "Monte Carlo" },
];

const subscribeToHydration = () => () => undefined;

export function ResearchTerminal({ initialReport }: { initialReport: BacktestResponse }) {
  const [request, setRequest] = useState<BacktestRequest>(DEFAULT_REQUEST);
  const [symbolsInput, setSymbolsInput] = useState(DEFAULT_REQUEST.symbols.join(", "));
  const [inputRevision, setInputRevision] = useState(0);
  const [report, setReport] = useState<BacktestResponse>(initialReport);
  const [chartSymbol, setChartSymbol] = useState(initialReport.metadata.symbols[0]);
  const [activeTab, setActiveTab] = useState<ResultTab>("performance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedRequest = loadResearchRequest();
      const savedReport = loadResearchReport();
      if (savedRequest) {
        const migratedRequest = {
          ...DEFAULT_REQUEST,
          ...savedRequest,
          parameters: { ...DEFAULT_REQUEST.parameters, ...savedRequest.parameters },
        };
        const latestDate = latestCompletedMarketDate(migratedRequest.market);
        const restoredRequest = migratedRequest.end > latestDate
          ? { ...migratedRequest, end: latestDate }
          : migratedRequest;
        setRequest(restoredRequest);
        setSymbolsInput(restoredRequest.symbols.join(", "));
      }
      if (savedReport) setReport(savedReport);
      setSessionReady(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (sessionReady) saveResearchRequest(request);
  }, [request, sessionReady]);

  useEffect(() => {
    if (sessionReady) saveResearchReport(report);
  }, [report, sessionReady]);

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
    clearResearchSession();
    setRequest(DEFAULT_REQUEST);
    setSymbolsInput(DEFAULT_REQUEST.symbols.join(", "));
    setInputRevision((current) => current + 1);
    setReport(initialReport);
    setChartSymbol(initialReport.metadata.symbols[0]);
    setError(null);
    setErrorFields([]);
    setLoading(false);
    setControlsOpen(false);
  }

  const inputCurrency = request.market === "US" ? "USD" : "INR";
  const resultCurrency = report.metadata.market === "US" ? "USD" : "INR";
  const latestDate = latestCompletedMarketDate(request.market);
  const symbol = report.metadata.symbols.includes(chartSymbol)
    ? chartSymbol
    : report.metadata.symbols[0];
  const symbolTradeCount = report.trades.filter((trade) => trade.symbol === symbol).length;
  const interactiveReady = ready && sessionReady;
  return (
    <main id="main-content" className={styles.main} data-ready={interactiveReady} data-route="research">
      <section className={styles.workspace} aria-live="polite" aria-busy={!interactiveReady || loading}>
        <header className={styles.workspaceHeader}>
          <div>
            <p className={styles.contextLine}>Backtest research / {report.metadata.symbols.join(" + ")}</p>
            <h1>{report.metadata.strategyLabel}</h1>
            <p>{formatDate(report.metadata.start)} to {formatDate(report.metadata.end)} · {report.metadata.market} · {sourceLabel(report.metadata.dataSource)}</p>
          </div>
          <details className={styles.exportMenu}>
            <summary title="Export results">Export</summary>
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
                {controlsOpen ? "Close setup" : "Edit setup"}
              </button>
              <button className={styles.resetButton} type="button" onClick={reset}>Reset</button>
              <button className={styles.runButton} data-magnetic type="submit" form="backtest-form" disabled={!ready || loading}>
                {loading ? "Running backtest" : "Run backtest"}
              </button>
            </div>
          </header>

          <p className={styles.executionPath}>Signal at close · Fill at next open · Costs applied</p>

          {error && (
            <div className={styles.errorBanner} role="alert">
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
                      <DateInput id="start" value={request.start} max={latestDate} ariaInvalid={errorFields.includes("start")} onValueChange={(value) => updateRequest("start", value)} />
                    </FormField>
                    <FormField label="End" htmlFor="end" hint={`Latest allowed date: ${formatDate(latestDate)}.`}>
                      <DateInput id="end" value={request.end} max={latestDate} ariaInvalid={errorFields.includes("end")} onValueChange={(value) => updateRequest("end", value)} />
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
                    <summary>Position and risk</summary>
                    <FormField label="Sizing method" htmlFor="sizing-method">
                      <select
                        id="sizing-method"
                        value={request.sizing_method}
                        onChange={(event) => {
                          const method = event.target.value as BacktestRequest["sizing_method"];
                          const positionSize = method === "fixed_dollar" ? 10_000 : method === "fixed_shares" ? 10 : 1;
                          setRequest((current) => ({ ...current, sizing_method: method, position_size: positionSize }));
                        }}
                      >
                        <option value="percentage">Portfolio percentage</option>
                        <option value="fixed_dollar">Fixed dollar</option>
                        <option value="fixed_shares">Fixed shares</option>
                      </select>
                    </FormField>
                    <FormField label={positionSizeLabel(request, inputCurrency)} htmlFor="position-size">
                      <NumberInput
                        id="position-size"
                        min={request.sizing_method === "fixed_shares" ? 1 : 0.1}
                        max={request.sizing_method === "percentage" ? 100 : undefined}
                        step={request.sizing_method === "fixed_shares" ? 1 : request.sizing_method === "percentage" ? 0.1 : 0.01}
                        value={request.sizing_method === "percentage" ? request.position_size * 100 : request.position_size}
                        onValueChange={(value) => updateRequest("position_size", request.sizing_method === "percentage" ? value / 100 : value)}
                      />
                    </FormField>
                    <div className={styles.twoColumns}>
                      <OptionalRateField id="stop-loss" label="Stop loss (%)" value={request.stop_loss} onValueChange={(value) => updateRequest("stop_loss", value)} />
                      <OptionalRateField id="take-profit" label="Take profit (%)" value={request.take_profit} onValueChange={(value) => updateRequest("take_profit", value)} />
                    </div>
                    <div className={styles.twoColumns}>
                      <FormField label="Max position (%)" htmlFor="max-position"><NumberInput id="max-position" min={0.1} max={100} step={0.1} value={request.max_position_allocation * 100} onValueChange={(value) => updateRequest("max_position_allocation", value / 100)} /></FormField>
                      <FormField label="Max exposure (%)" htmlFor="max-exposure"><NumberInput id="max-exposure" min={0.1} max={100} step={0.1} value={request.max_portfolio_exposure * 100} onValueChange={(value) => updateRequest("max_portfolio_exposure", value / 100)} /></FormField>
                    </div>
                  </details>
                  <details className={styles.advanced}>
                    <summary>Analytics setting</summary>
                    <FormField label="Risk-free rate (%)" htmlFor="risk-free-rate">
                      <NumberInput id="risk-free-rate" min={-99} max={100} step={0.1} value={request.risk_free_rate * 100} onValueChange={(value) => updateRequest("risk_free_rate", value / 100)} />
                    </FormField>
                    <div className={styles.twoColumns}>
                      <FormField label="Simulation days" htmlFor="simulation-days"><NumberInput id="simulation-days" min={20} max={756} step={1} value={request.monte_carlo_horizon} onValueChange={(value) => updateRequest("monte_carlo_horizon", value)} /></FormField>
                      <FormField label="Simulations" htmlFor="simulation-count"><NumberInput id="simulation-count" min={50} max={1000} step={50} value={request.monte_carlo_simulations} onValueChange={(value) => updateRequest("monte_carlo_simulations", value)} /></FormField>
                    </div>
                    <FormField label="Random seed" htmlFor="simulation-seed"><NumberInput id="simulation-seed" min={0} max={4294967295} step={1} value={request.monte_carlo_seed} onValueChange={(value) => updateRequest("monte_carlo_seed", value)} /></FormField>
                  </details>
                </fieldset>
              </div>
            </form>
          </div>
        </section>

        <div className={styles.disclaimer} role="note">
          <span>Results are hypothetical and depend on the data and assumptions shown here. They are not investment advice or a promise of future performance.</span>
          <Link href="/disclaimer">Read disclaimer</Link>
        </div>

        <section className={styles.pricePanel} data-motion-reveal="chart" aria-labelledby="price-heading">
          <div className={styles.panelHeader}>
            <div><span>Price, indicators, and fills</span><h2 id="price-heading">{symbol} daily bars</h2></div>
            <span className={styles.tradeCount}>{symbolTradeCount} fills</span>
          </div>
          {report.metadata.symbols.length > 1 && (
            <div className={styles.tickerRail} role="group" aria-label="Chart ticker">
              <span>Instrument</span>
              <div>
                {report.metadata.symbols.map((ticker) => (
                  <button key={ticker} type="button" aria-pressed={symbol === ticker} onClick={() => setChartSymbol(ticker)}>{ticker}</button>
                ))}
              </div>
            </div>
          )}
          <div className={styles.priceChart}><FinancialChart report={report} mode="price" symbol={symbol} /></div>
          {loading && <LoadingOverlay />}
        </section>

        <PriceDataTable report={report} symbol={symbol} />

        <div className={styles.portfolioScope}>
          <span>Portfolio metrics</span>
          <strong>{report.metadata.symbols.length} {assetWord(report.metadata.symbols.length)} · {report.trades.length} fills</strong>
        </div>

        <section className={styles.metrics} data-motion-reveal="text" aria-label="Performance metrics">
          <Metric label="Total return" value={formatPercent(report.metrics.totalReturn)} />
          <Metric label="Annualized" value={formatPercent(report.metrics.annualizedReturn)} />
          <Metric label="Volatility" value={formatPercent(report.metrics.annualizedVolatility)} />
          <Metric label="Sharpe ratio" value={formatNumber(report.metrics.sharpeRatio)} />
          <Metric label="Max drawdown" value={formatPercent(report.metrics.maximumDrawdown)} />
          <Metric label="Win rate" value={formatPercent(report.metrics.winRate)} />
          <Metric label="Final value" value={formatMoney(report.metrics.finalValue, resultCurrency)} />
        </section>

        <AssetAttributionTable report={report} currency={resultCurrency} />

        <ResultReadout report={report} currency={resultCurrency} />

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
              {tab.label}
            </button>
          ))}
        </div>

        <section className={styles.resultPanel} data-motion-reveal="chart" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          <div key={activeTab} className={styles.tabStage}>
          {activeTab === "trades" ? (
            <TradeTable report={report} currency={resultCurrency} />
          ) : activeTab === "study" ? (
            <StrategyStudy report={report} />
          ) : activeTab === "portfolio" ? (
            <PortfolioLab report={report} />
          ) : activeTab === "simulation" ? (
            <MonteCarloLab report={report} currency={resultCurrency} />
          ) : (
            <div className={styles.resultChart}>
              <FinancialChart report={report} mode={activeTab} />
            </div>
          )}
          </div>
        </section>

        <details className={styles.assumptions} data-motion-reveal="text">
          <summary>
            <span><strong>Methodology and assumptions</strong><small>Review the rules behind this result.</small></span>
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

function OptionalRateField({
  id,
  label,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <input
        id={id}
        type="number"
        min={0.1}
        max={1000}
        step={0.1}
        placeholder="Off"
        value={value === null ? "" : value * 100}
        onChange={(event) => {
          const draft = event.target.value;
          onValueChange(draft === "" ? null : Number(draft) / 100);
        }}
      />
    </FormField>
  );
}

function DateInput({
  id,
  value,
  max,
  onValueChange,
  ariaInvalid = false,
}: {
  id: string;
  value: string;
  max: string;
  onValueChange: (value: string) => void;
  ariaInvalid?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    // Saved sessions and resets must replace an unfinished date draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  return (
    <input
      id={id}
      type="date"
      required
      max={max}
      value={draft}
      aria-invalid={ariaInvalid || undefined}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        if (isIsoDate(nextDraft)) onValueChange(nextDraft);
      }}
      onBlur={() => {
        if (!isIsoDate(draft)) setDraft(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
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
      <FormField label={`Top assets (of ${request.symbols.length})`} htmlFor="top-assets"><NumberInput id="top-assets" min={1} max={Math.max(1, request.symbols.length)} value={parameters.top_n} onValueChange={(value) => update("top_n", value)} /></FormField>
    </div>
    <FormField label="Rebalance frequency" htmlFor="rebalance-frequency"><NumberInput id="rebalance-frequency" min={1} max={252} value={parameters.rebalance_frequency} onValueChange={(value) => update("rebalance_frequency", value)} /></FormField>
    <label className={styles.checkbox}><input type="checkbox" checked={parameters.require_positive_returns} onChange={(event) => update("require_positive_returns", event.target.checked)} /><span>Require positive trailing returns</span></label>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}<Link href="/methodology" aria-label={`Read ${label} methodology`}>Method</Link></span><strong>{value}</strong></div>;
}

function AssetAttributionTable({ report, currency }: { report: BacktestResponse; currency: string }) {
  const rows = calculateAssetAttribution(report);
  const selected = rows.filter((row) => row.selected);

  return (
    <section className={styles.attribution} data-motion-reveal="text" aria-labelledby="asset-attribution-heading">
      <header className={styles.attributionHeader}>
        <div>
          <span>Portfolio breakdown</span>
          <h2 id="asset-attribution-heading">Asset attribution</h2>
        </div>
        <p>Ranked by net strategy P&amp;L.</p>
      </header>

      {report.metadata.strategy === "momentum" && (
        <div className={styles.latestSelection}>
          <span>Latest selection</span>
          <strong>{selected.length ? selected.map((row) => row.symbol).join(" · ") : "Cash"}</strong>
        </div>
      )}

      <div className={`${styles.tableWrap} ${styles.attributionTable}`}>
        <table>
          <caption>Asset attribution for this backtest</caption>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Ticker</th>
              <th title="Price change from the first close to the final close.">Stock return</th>
              <th>Final price</th>
              <th title="Realized and unrealized profit or loss after trading costs.">Strategy P&amp;L</th>
              <th title="The asset's strategy P&amp;L divided by starting cash.">Contribution</th>
              <th title="Ending holding value divided by final portfolio value.">End weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td>{row.rank}</td>
                <td>
                  <strong>{row.symbol}</strong>
                  {report.metadata.strategy === "momentum" && row.selected && <small>Selected</small>}
                </td>
                <ToneCell value={row.periodReturn}>{formatPercent(row.periodReturn)}</ToneCell>
                <td>{formatMoney(row.finalPrice, currency)}</td>
                <ToneCell value={row.netPnl}>{formatMoney(row.netPnl, currency)}</ToneCell>
                <ToneCell value={row.returnContribution}>{formatPercent(row.returnContribution)}</ToneCell>
                <td>{formatPercent(row.portfolioWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ToneCell({ value, children }: { value: number | null; children: React.ReactNode }) {
  const tone = value === null || Math.abs(value) < 1e-10 ? "flat" : value > 0 ? "gain" : "loss";
  return <td data-tone={tone}>{children}</td>;
}

function ResultReadout({ report, currency }: { report: BacktestResponse; currency: string }) {
  const explanation = explainResults(report, currency);
  return (
    <section className={styles.explanation} data-motion-reveal="text" aria-labelledby="result-explanation-heading">
      <header className={styles.explanationHeader}>
        <div>
          <span>Research readout</span>
          <h2 id="result-explanation-heading">What this run actually says</h2>
        </div>
        <strong data-tone={explanation.tone}>{explanation.status}</strong>
      </header>

      <p className={styles.explanationLead}>{explanation.outcome}</p>
      <dl className={styles.readoutRows}>
        <div><dt>Against holding</dt><dd>{explanation.comparison}</dd></div>
        <div><dt>Downside</dt><dd>{explanation.risk}</dd></div>
        <div><dt>Sample</dt><dd>{explanation.evidence}</dd></div>
        <div><dt>Last rule</dt><dd>{explanation.decisionBody}</dd></div>
        <div><dt>Next step</dt><dd>{explanation.futureBody}</dd></div>
      </dl>
    </section>
  );
}

function StrategyStudy({ report }: { report: BacktestResponse }) {
  const study = report.strategyStudy;
  const trials = study?.trials ?? [];
  if (!trials.length) {
    return <div className={styles.emptyState}><h3>No parameter study yet</h3><p>Run the backtest once to compare the fixed strategy setups.</p></div>;
  }
  const bestByStrategy = study?.bestByStrategy?.length
    ? study.bestByStrategy
    : bestTrialForEachStrategy(trials);
  const leader = study?.historicalWinner
    ?? [...bestByStrategy].sort((left, right) => right.validationReturn - left.validationReturn)[0];
  return <div className={styles.study}>
    <header className={styles.studyWinner}>
      <div><span>Best on the final 30%</span><h3>{leader.strategy}</h3></div>
      <strong>{formatPercent(leader.validationReturn)}</strong>
      <p>{formatStrategySettings(leader)} It earned {formatPercent(leader.selectionReturn)} while settings were chosen on the first 70%.</p>
    </header>
    <div className={styles.familyStudy}>
      <div className={styles.familyStudyIntro}>
        <strong>Best settings found for each strategy</strong>
        <span>Same stocks, dates, costs, and {study?.sharedLookback ?? "chosen"}-day lookback where used.</span>
      </div>
      <div className={styles.familyRows}>
        {bestByStrategy.map((trial) => <div key={trial.strategy} data-winner={trial.strategy === leader.strategy || undefined}>
          <div><strong>{trial.strategy}</strong><span>{formatStrategySettings(trial)}</span></div>
          <dl><div><dt>First 70%</dt><dd>{formatPercent(trial.selectionReturn)}</dd></div><div><dt>Final 30%</dt><dd>{formatPercent(trial.validationReturn)}</dd></div></dl>
        </div>)}
      </div>
    </div>
    <p className={styles.studyNote}>Each strategy picks its settings from the first 70% of the dates. The final 30% checks those choices on later prices. The winner describes this backtest, not the future.</p>
    <div className={styles.tableWrap}>
      <table>
        <caption>Historical strategy parameter study</caption>
        <thead><tr><th>Rank</th><th>Strategy and settings</th><th>First 70%</th><th>Final 30%</th><th>Full period</th><th>Drawdown</th><th>Trades</th></tr></thead>
        <tbody>{trials.map((trial) => <tr key={`${trial.strategy}-${JSON.stringify(trial.parameters)}`}>
          <td>{trial.rank}</td><td>{trial.strategy}<small>{formatParameters(trial)}</small></td>
          <td>{formatPercent(trial.selectionReturn)}</td><td>{formatPercent(trial.validationReturn)}</td>
          <td>{formatPercent(trial.fullPeriodReturn)}</td><td>{formatPercent(trial.maximumDrawdown)}</td><td>{trial.tradeCount}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function TradeTable({ report, currency }: { report: BacktestResponse; currency: string }) {
  if (!report.trades.length) {
    return <div className={styles.emptyState}><h3>No trades executed</h3><p>The selected strategy held cash for this period.</p></div>;
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
  if (!isIsoDate(value)) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatParameters(trial: StrategyStudyTrial): string {
  return Object.entries(trial.parameters)
    .map(([key, value]) => `${key.replaceAll("_", " ")} ${String(value)}`)
    .join(" · ");
}

function formatStrategySettings(trial: StrategyStudyTrial): string {
  const parameters = trial.parameters;
  if (trial.strategy === "Moving average crossover") {
    return `Short ${parameters.short_window} days · long ${parameters.long_window} days.`;
  }
  if (trial.strategy === "Mean reversion") {
    return `Entry z-score ${parameters.entry_z_score} · exit z-score ${parameters.exit_z_score} · lookback ${parameters.lookback_window} days.`;
  }
  return `Rebalance every ${parameters.rebalance_frequency} trading days · lookback ${parameters.lookback_window} days · top ${parameters.top_n}.`;
}

function bestTrialForEachStrategy(trials: StrategyStudyTrial[]): StrategyStudyTrial[] {
  return STRATEGIES.map(({ label }) => {
    const strategyLabel = label === "Moving average" ? "Moving average crossover" : label;
    return trials
      .filter((trial) => trial.strategy === strategyLabel)
      .sort((left, right) => right.selectionReturn - left.selectionReturn)[0];
  }).filter((trial): trial is StrategyStudyTrial => Boolean(trial));
}

function sourceLabel(source: BacktestResponse["metadata"]["dataSource"]): string {
  return source === "demo" ? "Demo data" : "Yahoo Finance";
}

function PriceDataTable({ report, symbol }: { report: BacktestResponse; symbol: string }) {
  const bars = report.market[symbol].slice(-20);
  return (
    <details className={styles.chartData}>
      <summary>View recent chart data</summary>
      <div className={styles.tableWrap}>
        <table>
          <caption>Twenty most recent {symbol} price bars shown in the chart</caption>
          <thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead>
          <tbody>{bars.map((bar) => <tr key={bar.time}><td>{bar.time}</td><td>{formatNumber(bar.open)}</td><td>{formatNumber(bar.high)}</td><td>{formatNumber(bar.low)}</td><td>{formatNumber(bar.close)}</td><td>{formatNumber(bar.volume, 0)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function assetWord(count: number): string {
  return count === 1 ? "asset" : "assets";
}

function positionSizeLabel(request: BacktestRequest, currency: string): string {
  if (request.sizing_method === "fixed_dollar") return `Amount per active asset (${currency})`;
  if (request.sizing_method === "fixed_shares") return "Shares per active asset";
  return "Portfolio allocation (%)";
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
  const latestDate = latestCompletedMarketDate(request.market);
  if (request.end > latestDate) return { message: `End date cannot be later than ${formatDate(latestDate)}, the latest allowed market date.`, fields: ["end"] };
  if (request.strategy === "moving_average" && request.parameters.short_window >= request.parameters.long_window) {
    return { message: "Short window must be smaller than long window.", fields: ["short_window", "long_window"] };
  }
  if (request.strategy === "mean_reversion" && request.parameters.entry_z_score >= request.parameters.exit_z_score) {
    return { message: "Entry z-score must be smaller than exit z-score.", fields: ["entry_z_score", "exit_z_score"] };
  }
  if (request.strategy === "momentum" && request.parameters.top_n > request.symbols.length) {
    return { message: "Top assets cannot exceed the ticker count.", fields: ["top_n", "symbols"] };
  }
  if (request.sizing_method === "percentage" && request.position_size > 1) {
    return { message: "Portfolio allocation cannot exceed 100%.", fields: ["position-size"] };
  }
  if (request.max_position_allocation > request.max_portfolio_exposure) {
    return { message: "Maximum position cannot exceed maximum portfolio exposure.", fields: ["max-position", "max-exposure"] };
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
