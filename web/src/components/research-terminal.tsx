"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ResearchWorkspace } from "@/components/workspace/research-workspace";
import { ResearchApiError, runBacktest } from "@/lib/api";
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
  type StrategyId,
} from "@/lib/types";
import { useWorkspaceStore } from "@/lib/workspace-store";
import styles from "./research-terminal.module.css";

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

const subscribeToHydration = () => () => undefined;

export function ResearchTerminal({ initialReport }: { initialReport: BacktestResponse }) {
  const [request, setRequest] = useState<BacktestRequest>(DEFAULT_REQUEST);
  const [symbolsInput, setSymbolsInput] = useState(DEFAULT_REQUEST.symbols.join(", "));
  const [inputRevision, setInputRevision] = useState(0);
  const [report, setReport] = useState<BacktestResponse>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const activeRequest = useRef<AbortController | null>(null);
  const setWorkspaceInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);
  const backtest = useMutation({
    mutationFn: ({ nextRequest, signal }: { nextRequest: BacktestRequest; signal: AbortSignal }) => runBacktest(nextRequest, signal),
  });

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedRequest = loadResearchRequest();
      const savedReport = loadResearchReport();
      if (savedRequest) {
        const latestDate = latestCompletedMarketDate(savedRequest.market);
        const restoredRequest = savedRequest.end > latestDate ? { ...savedRequest, end: latestDate } : savedRequest;
        setRequest(restoredRequest);
        setSymbolsInput(restoredRequest.symbols.join(", "));
        setInputRevision((current) => current + 1);
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
    setError(null);
    setErrorFields([]);
    try {
      const nextReport = await backtest.mutateAsync({ nextRequest: request, signal: controller.signal });
      setReport(nextReport);
      setControlsOpen(false);
      setWorkspaceInspectorOpen(false);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "The backtest could not be completed.");
      if (caught instanceof ResearchApiError) {
        setErrorFields(caught.fields);
        if (caught.fields.length) focusFirstField(caught.fields);
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  function updateRequest<K extends keyof BacktestRequest>(key: K, value: BacktestRequest[K]) {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  function updateParameter(key: keyof BacktestRequest["parameters"], value: number | boolean) {
    setRequest((current) => ({ ...current, parameters: { ...current.parameters, [key]: value } }));
  }

  function reset() {
    activeRequest.current?.abort();
    clearResearchSession();
    setRequest(DEFAULT_REQUEST);
    setSymbolsInput(DEFAULT_REQUEST.symbols.join(", "));
    setInputRevision((current) => current + 1);
    setReport(initialReport);
    setError(null);
    setErrorFields([]);
    setControlsOpen(false);
    setWorkspaceInspectorOpen(false);
    backtest.reset();
  }

  const ready = hydrated && sessionReady;
  const latestDate = latestCompletedMarketDate(request.market);
  const inputCurrency = request.market === "US" ? "USD" : "INR";

  return (
    <ResearchWorkspace
      report={report}
      request={request}
      loading={backtest.isPending}
      ready={ready}
      controlsOpen={controlsOpen}
      error={error}
      onToggleSetup={() => setControlsOpen((current) => !current)}
      onRun={() => undefined}
      onResetRequest={reset}
      onDownloadJson={() => downloadJson(report)}
      onDownloadTrades={() => downloadTrades(report)}
      inspector={(
        <ExperimentForm
          key={inputRevision}
          request={request}
          symbolsInput={symbolsInput}
          errorFields={errorFields}
          latestDate={latestDate}
          inputCurrency={inputCurrency}
          onSubmit={handleSubmit}
          onRequestChange={updateRequest}
          onParameterChange={updateParameter}
          onSymbolsInputChange={setSymbolsInput}
          onMarketChange={(market) => {
            const symbols = MARKET_DEFAULTS[market];
            setSymbolsInput(symbols.join(", "));
            setRequest((current) => ({ ...current, market, symbols }));
          }}
        />
      )}
    />
  );
}

function ExperimentForm({
  request,
  symbolsInput,
  errorFields,
  latestDate,
  inputCurrency,
  onSubmit,
  onRequestChange,
  onParameterChange,
  onSymbolsInputChange,
  onMarketChange,
}: {
  request: BacktestRequest;
  symbolsInput: string;
  errorFields: string[];
  latestDate: string;
  inputCurrency: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRequestChange: <K extends keyof BacktestRequest>(key: K, value: BacktestRequest[K]) => void;
  onParameterChange: (key: keyof BacktestRequest["parameters"], value: number | boolean) => void;
  onSymbolsInputChange: (value: string) => void;
  onMarketChange: (market: Market) => void;
}) {
  return <div className={styles.inspectorForm}>
    <div className={styles.formSummary}>
      <span>Active experiment</span>
      <p>{requestSummary(request)}</p>
      <div><small>Signal at close</small><ArrowRight size={12} /><small>Next open fill</small><ArrowRight size={12} /><small>Costs applied</small></div>
    </div>
    <form id="backtest-form" onSubmit={onSubmit}>
      <fieldset>
        <legend>Market data</legend>
        <FormField label="Source" htmlFor="data-source">
          <select id="data-source" value={request.data_source} onChange={(event) => onRequestChange("data_source", event.target.value as BacktestRequest["data_source"])}>
            <option value="demo">Deterministic demo</option>
            <option value="yahoo">Yahoo Finance (local)</option>
          </select>
        </FormField>
        <FormField label="Market" htmlFor="market">
          <select id="market" value={request.market} onChange={(event) => onMarketChange(event.target.value as Market)}>
            {Object.keys(MARKET_DEFAULTS).map((market) => <option key={market}>{market}</option>)}
          </select>
        </FormField>
        <FormField label="Tickers" htmlFor="symbols" hint="Comma-separate up to six tickers.">
          <input
            id="symbols"
            aria-invalid={errorFields.includes("symbols") || undefined}
            aria-describedby="symbols-hint"
            value={symbolsInput}
            onChange={(event) => {
              onSymbolsInputChange(event.target.value);
              onRequestChange("symbols", parseTickerInput(event.target.value));
            }}
            placeholder="AAPL, MSFT"
          />
        </FormField>
        <div className={styles.twoColumns}>
          <FormField label="Start" htmlFor="start"><DateInput id="start" value={request.start} max={latestDate} ariaInvalid={errorFields.includes("start")} onValueChange={(value) => onRequestChange("start", value)} /></FormField>
          <FormField label="End" htmlFor="end" hint={`Latest: ${formatDate(latestDate)}`}><DateInput id="end" value={request.end} max={latestDate} ariaInvalid={errorFields.includes("end")} onValueChange={(value) => onRequestChange("end", value)} /></FormField>
        </div>
      </fieldset>

      <fieldset>
        <legend>Strategy</legend>
        <FormField label="Model" htmlFor="strategy">
          <select id="strategy" value={request.strategy} onChange={(event) => onRequestChange("strategy", event.target.value as StrategyId)}>
            {STRATEGIES.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.label}</option>)}
          </select>
        </FormField>
        <StrategyFields key={request.strategy} request={request} update={onParameterChange} errorFields={errorFields} />
      </fieldset>

      <fieldset>
        <legend>Execution</legend>
        <FormField label={`Starting cash (${inputCurrency})`} htmlFor="initial-cash"><NumberInput id="initial-cash" min={1} step={1} value={request.initial_cash} onValueChange={(value) => onRequestChange("initial_cash", value)} /></FormField>
        <div className={styles.twoColumns}>
          <FormField label="Commission (%)" htmlFor="commission"><NumberInput id="commission" min={0} max={5} step={0.01} value={request.commission_rate * 100} onValueChange={(value) => onRequestChange("commission_rate", value / 100)} /></FormField>
          <FormField label="Slippage (bps)" htmlFor="slippage"><NumberInput id="slippage" min={0} max={9999} step={1} value={request.slippage_bps} onValueChange={(value) => onRequestChange("slippage_bps", value)} /></FormField>
        </div>
        <FormField label={`Fixed fee (${inputCurrency})`} htmlFor="fixed-fee"><NumberInput id="fixed-fee" min={0} step={0.01} value={request.fixed_fee} onValueChange={(value) => onRequestChange("fixed_fee", value)} /></FormField>
        <FormField label="Risk-free rate (%)" htmlFor="risk-free-rate"><NumberInput id="risk-free-rate" min={-99} max={100} step={0.1} value={request.risk_free_rate * 100} onValueChange={(value) => onRequestChange("risk_free_rate", value / 100)} /></FormField>
      </fieldset>
    </form>
    <div className={styles.disclaimer} role="note"><Info size={13} /><span>Historical simulation. Not investment advice.</span><Link href="/disclaimer">Details</Link></div>
  </div>;
}

function FormField({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div className={styles.formField}><label htmlFor={htmlFor}>{label}</label>{children}{hint && <small id={`${htmlFor}-hint`}>{hint}</small>}</div>;
}

function NumberInput({ id, value, onValueChange, ariaInvalid = false, min, max, step }: { id: string; value: number; onValueChange: (value: number) => void; ariaInvalid?: boolean; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState(String(value));
  return <input id={id} type="number" required min={min} max={max} step={step} value={draft} aria-invalid={ariaInvalid || undefined} onChange={(event) => {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    if (nextDraft === "") return;
    const nextValue = Number(nextDraft);
    if (Number.isFinite(nextValue)) onValueChange(nextValue);
  }} />;
}

function DateInput({ id, value, max, onValueChange, ariaInvalid = false }: { id: string; value: string; max: string; onValueChange: (value: string) => void; ariaInvalid?: boolean }) {
  const [draft, setDraft] = useState(value);
  return <input id={id} type="date" required max={max} value={draft} aria-invalid={ariaInvalid || undefined} onChange={(event) => {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    if (isIsoDate(nextDraft)) onValueChange(nextDraft);
  }} onBlur={() => { if (!isIsoDate(draft)) setDraft(value); }} onKeyDown={(event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value);
      event.currentTarget.blur();
    }
  }} />;
}

function StrategyFields({ request, update, errorFields }: { request: BacktestRequest; update: (key: keyof BacktestRequest["parameters"], value: number | boolean) => void; errorFields: string[] }) {
  const parameters = request.parameters;
  if (request.strategy === "moving_average") return <div className={styles.twoColumns}>
    <FormField label="Short window" htmlFor="short-window"><NumberInput id="short-window" ariaInvalid={errorFields.includes("short_window")} min={2} max={500} value={parameters.short_window} onValueChange={(value) => update("short_window", value)} /></FormField>
    <FormField label="Long window" htmlFor="long-window"><NumberInput id="long-window" ariaInvalid={errorFields.includes("long_window")} min={3} max={750} value={parameters.long_window} onValueChange={(value) => update("long_window", value)} /></FormField>
  </div>;
  if (request.strategy === "mean_reversion") return <>
    <FormField label="Lookback window" htmlFor="lookback-window"><NumberInput id="lookback-window" min={2} max={750} value={parameters.lookback_window} onValueChange={(value) => update("lookback_window", value)} /></FormField>
    <div className={styles.twoColumns}>
      <FormField label="Entry z-score" htmlFor="entry-z"><NumberInput id="entry-z" min={-10} max={0} step={0.1} value={parameters.entry_z_score} onValueChange={(value) => update("entry_z_score", value)} /></FormField>
      <FormField label="Exit z-score" htmlFor="exit-z"><NumberInput id="exit-z" min={-5} max={10} step={0.1} value={parameters.exit_z_score} onValueChange={(value) => update("exit_z_score", value)} /></FormField>
    </div>
  </>;
  return <>
    <div className={styles.twoColumns}>
      <FormField label="Lookback" htmlFor="momentum-lookback"><NumberInput id="momentum-lookback" min={2} max={750} value={parameters.lookback_window} onValueChange={(value) => update("lookback_window", value)} /></FormField>
      <FormField label="Top assets" htmlFor="top-assets"><NumberInput id="top-assets" min={1} max={6} value={parameters.top_n} onValueChange={(value) => update("top_n", value)} /></FormField>
    </div>
    <FormField label="Rebalance frequency" htmlFor="rebalance-frequency"><NumberInput id="rebalance-frequency" min={1} max={252} value={parameters.rebalance_frequency} onValueChange={(value) => update("rebalance_frequency", value)} /></FormField>
    <label className={styles.checkbox}><input type="checkbox" checked={parameters.require_positive_returns} onChange={(event) => update("require_positive_returns", event.target.checked)} /><span>Require positive trailing returns</span></label>
  </>;
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

function focusFirstField(fields: string[]) {
  const ids: Record<string, string> = { symbols: "symbols", start: "start", end: "end", short_window: "short-window", long_window: "long-window", entry_z_score: "entry-z", exit_z_score: "exit-z", top_n: "top-assets" };
  requestAnimationFrame(() => document.getElementById(ids[fields[0]] ?? fields[0])?.focus());
}

function validateRequest(request: BacktestRequest): { message: string; fields: string[] } | null {
  if (!request.symbols.length) return { message: "Enter at least one ticker symbol.", fields: ["symbols"] };
  if (request.symbols.length > 6) return { message: "Enter no more than six ticker symbols.", fields: ["symbols"] };
  if (request.end <= request.start) return { message: "End date must be later than start date.", fields: ["start", "end"] };
  const latestDate = latestCompletedMarketDate(request.market);
  if (request.end > latestDate) return { message: `End date cannot be later than ${formatDate(latestDate)}, the latest allowed market date.`, fields: ["end"] };
  if (request.strategy === "moving_average" && request.parameters.short_window >= request.parameters.long_window) return { message: "Short window must be smaller than long window.", fields: ["short_window", "long_window"] };
  if (request.strategy === "mean_reversion" && request.parameters.entry_z_score >= request.parameters.exit_z_score) return { message: "Entry z-score must be smaller than exit z-score.", fields: ["entry_z_score", "exit_z_score"] };
  if (request.strategy === "momentum" && request.parameters.top_n > request.symbols.length) return { message: "Top assets cannot exceed the ticker count.", fields: ["top_n", "symbols"] };
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
