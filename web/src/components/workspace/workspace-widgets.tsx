"use client";

import type { EChartsOption } from "echarts";
import {
  Copy,
  Expand,
  GripVertical,
  Info,
  Settings2,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { explainResults } from "@/lib/explain-results";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type {
  BacktestRequest,
  BacktestResponse,
  SignalRecord,
  StrategyStudyTrial,
  TradeRecord,
} from "@/lib/types";
import {
  latestAllocation,
  monthlyReturns,
  returnHistogram,
  rollingSharpe,
  rollingVolatility,
} from "@/lib/workspace-analytics";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { WIDGET_DEFINITIONS, type WorkspaceWidget } from "@/lib/workspace-types";
import { DataTable } from "./data-table";
import styles from "./workspace.module.css";

const FinancialChart = dynamic(
  () => import("@/components/financial-chart").then((module) => module.FinancialChart),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);

const QuantEChart = dynamic(
  () => import("./quant-echart").then((module) => module.QuantEChart),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);

export function WorkspaceWidgetCard({
  widget,
  report,
  request,
  loading,
}: {
  widget: WorkspaceWidget;
  report: BacktestResponse;
  request: BacktestRequest;
  loading: boolean;
}) {
  const selected = useWorkspaceStore((state) => state.selectedWidgetId === widget.id);
  const fullscreen = useWorkspaceStore((state) => state.fullscreenWidgetId === widget.id);
  const selectWidget = useWorkspaceStore((state) => state.selectWidget);
  const setInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);
  const setFullscreenWidget = useWorkspaceStore((state) => state.setFullscreenWidget);
  const duplicateWidget = useWorkspaceStore((state) => state.duplicateWidget);
  const removeWidget = useWorkspaceStore((state) => state.removeWidget);
  const definition = WIDGET_DEFINITIONS[widget.kind];

  return (
    <>
      <article
        className={styles.widget}
        data-selected={selected || undefined}
        data-widget-id={widget.id}
        onPointerDown={() => selectWidget(widget.id)}
      >
        <header className={styles.widgetHeader}>
          <button className={`workspace-drag-handle ${styles.dragHandle}`} type="button" aria-label={`Move ${widget.title}`}>
            <GripVertical aria-hidden="true" size={15} />
          </button>
          <div>
            <span>{definition.category}</span>
            <h2>{widget.title}</h2>
          </div>
          <div className={styles.widgetActions}>
            <Tooltip label="Inspect widget">
              <button type="button" aria-label={`Inspect ${widget.title}`} onClick={() => { selectWidget(widget.id); setInspectorOpen(true); }}><Settings2 size={14} /></button>
            </Tooltip>
            <Tooltip label="Open fullscreen">
              <button type="button" aria-label={`Open ${widget.title} fullscreen`} onClick={() => setFullscreenWidget(widget.id)}><Expand size={14} /></button>
            </Tooltip>
            <Tooltip label="Duplicate widget">
              <button type="button" aria-label={`Duplicate ${widget.title}`} onClick={() => duplicateWidget(widget.id)}><Copy size={14} /></button>
            </Tooltip>
            <Tooltip label="Remove widget">
              <button type="button" aria-label={`Remove ${widget.title}`} onClick={() => removeWidget(widget.id)}><Trash2 size={14} /></button>
            </Tooltip>
          </div>
        </header>
        <div className={styles.widgetBody}>
          <WidgetContent widget={widget} report={report} request={request} />
          {loading && <WidgetLoading />}
        </div>
        <footer className={styles.widgetFooter}>
          <span>Through {report.metadata.end}</span>
          <span>{sourceLabel(report.metadata.dataSource)}</span>
        </footer>
      </article>

      <Dialog open={fullscreen} onOpenChange={(open) => setFullscreenWidget(open ? widget.id : null)}>
        <DialogContent title={`${widget.title} fullscreen`} className={styles.fullscreenDialog}>
          <header className={styles.fullscreenHeader}><span>{definition.category}</span><h2>{widget.title}</h2></header>
          <div className={styles.fullscreenBody}><WidgetContent widget={widget} report={report} request={request} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WidgetContent({
  widget,
  report,
  request,
}: {
  widget: WorkspaceWidget;
  report: BacktestResponse;
  request: BacktestRequest;
}) {
  switch (widget.kind) {
    case "price":
      return <ChartFrame><FinancialChart report={report} mode="market" /></ChartFrame>;
    case "price-signals":
      return <ChartFrame><FinancialChart report={report} mode="price" /></ChartFrame>;
    case "equity":
      return <ChartFrame><FinancialChart report={report} mode="performance" /></ChartFrame>;
    case "drawdown":
      return <ChartFrame><FinancialChart report={report} mode="drawdown" /></ChartFrame>;
    case "strategy-benchmark":
      return <ChartFrame><FinancialChart report={report} mode="comparison" /></ChartFrame>;
    case "metrics":
      return <Metrics report={report} />;
    case "rolling-volatility":
      return <RollingChart report={report} kind="volatility" />;
    case "rolling-sharpe":
      return <RollingChart report={report} kind="sharpe" />;
    case "monthly-returns":
      return <MonthlyHeatmap report={report} />;
    case "return-distribution":
      return <ReturnDistribution report={report} />;
    case "allocation":
      return <Allocation report={report} />;
    case "trades":
      return <TradeTable report={report} />;
    case "signals":
      return <SignalTable report={report} />;
    case "parameters":
      return <Parameters request={request} report={report} />;
    case "assumptions":
      return <Assumptions report={report} />;
    case "parameter-study":
      return <StrategyStudy report={report} />;
    case "explanation":
      return <ResultReadout report={report} />;
    case "limitations":
      return <Limitations report={report} />;
  }
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return <div className={styles.chartFrame}>{children}</div>;
}

function Metrics({ report }: { report: BacktestResponse }) {
  const currency = report.metadata.market === "US" ? "USD" : "INR";
  const metrics = [
    ["Total return", formatPercent(report.metrics.totalReturn)],
    ["Annualized", formatPercent(report.metrics.annualizedReturn)],
    ["Volatility", formatPercent(report.metrics.annualizedVolatility)],
    ["Sharpe ratio", formatNumber(report.metrics.sharpeRatio)],
    ["Max drawdown", formatPercent(report.metrics.maximumDrawdown)],
    ["Win rate", formatPercent(report.metrics.winRate)],
    ["Final value", formatMoney(report.metrics.finalValue, currency)],
    ["Trades", String(report.metrics.tradeCount)],
  ];
  return <dl className={styles.metricGrid}>{metrics.map(([label, value]) => (
    <div key={label}><dt>{label}<Link href="/methodology" aria-label={`Read ${label} methodology`}><Info size={11} /></Link></dt><dd>{value}</dd></div>
  ))}</dl>;
}

function RollingChart({ report, kind }: { report: BacktestResponse; kind: "volatility" | "sharpe" }) {
  const values = kind === "volatility" ? rollingVolatility(report.portfolio.equity) : rollingSharpe(report.portfolio.equity);
  const option = useMemo<EChartsOption>(() => ({
    ...BASE_ECHART,
    grid: CHART_GRID,
    xAxis: { type: "category", data: values.map((point) => point.time), axisLabel: AXIS_LABEL, axisLine: AXIS_LINE },
    yAxis: { type: "value", axisLabel: { ...AXIS_LABEL, formatter: kind === "volatility" ? (value: number) => `${(value * 100).toFixed(0)}%` : undefined }, splitLine: SPLIT_LINE },
    tooltip: { trigger: "axis", valueFormatter: (value) => kind === "volatility" ? `${(Number(value) * 100).toFixed(2)}%` : Number(value).toFixed(2) },
    series: [{ type: "line", data: values.map((point) => point.value), showSymbol: false, smooth: false, lineStyle: { width: 2, color: "#7890a3" }, areaStyle: { color: "rgba(120,144,163,.10)" } }],
  }), [kind, values]);
  if (!values.length) return <EmptyState title="Not enough history" body="This estimate needs at least twenty returns." />;
  return <div className={styles.derivedChart}><QuantEChart option={option} label={`Twenty-day rolling ${kind} estimate`} /><small>Display estimate from returned equity data.</small></div>;
}

function MonthlyHeatmap({ report }: { report: BacktestResponse }) {
  const values = monthlyReturns(report.portfolio.equity);
  const years = useMemo(() => [...new Set(values.map((point) => point.year))], [values]);
  const data = values.map((point) => [point.month, years.indexOf(point.year), Number((point.value * 100).toFixed(2))]);
  const max = Math.max(1, ...values.map((point) => Math.abs(point.value * 100)));
  const option = useMemo<EChartsOption>(() => ({
    ...BASE_ECHART,
    grid: { top: 10, right: 18, bottom: 46, left: 48 },
    xAxis: { type: "category", data: MONTHS, axisLabel: AXIS_LABEL, axisLine: AXIS_LINE },
    yAxis: { type: "category", data: years, axisLabel: AXIS_LABEL, axisLine: AXIS_LINE },
    visualMap: { min: -max, max, calculable: false, orient: "horizontal", left: "center", bottom: 2, textStyle: { color: "#929aa1", fontSize: 10 }, inRange: { color: ["#8e4646", "#252a2f", "#3f8c69"] } },
    tooltip: { formatter: (params: unknown) => heatmapTooltip(params, years) },
    series: [{ type: "heatmap", data, label: { show: true, color: "#e9e5dd", fontSize: 9, formatter: (params: unknown) => heatmapLabel(params) }, emphasis: { itemStyle: { borderColor: "#ece9e2", borderWidth: 1 } } }],
  }), [data, max, years]);
  return <QuantEChart option={option} label="Monthly portfolio return heatmap" />;
}

function ReturnDistribution({ report }: { report: BacktestResponse }) {
  const bins = returnHistogram(report.portfolio.equity);
  const option = useMemo<EChartsOption>(() => ({
    ...BASE_ECHART,
    grid: CHART_GRID,
    xAxis: { type: "category", data: bins.map((bin) => bin.label), axisLabel: { ...AXIS_LABEL, rotate: 35 }, axisLine: AXIS_LINE },
    yAxis: { type: "value", axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    tooltip: { trigger: "axis" },
    series: [{ type: "bar", data: bins.map((bin) => bin.value), itemStyle: { color: "#7890a3" }, barMaxWidth: 36 }],
  }), [bins]);
  if (!bins.length) return <EmptyState title="No return sample" body="The report has no daily equity changes." />;
  return <QuantEChart option={option} label="Histogram of daily portfolio returns" />;
}

function Allocation({ report }: { report: BacktestResponse }) {
  const values = latestAllocation(report);
  const option = useMemo<EChartsOption>(() => ({
    ...BASE_ECHART,
    tooltip: { trigger: "item", valueFormatter: (value) => `${(Number(value) * 100).toFixed(1)}%` },
    legend: { bottom: 0, textStyle: { color: "#929aa1", fontSize: 10 }, itemWidth: 9, itemHeight: 9 },
    series: [{ type: "pie", radius: ["42%", "70%"], center: ["50%", "44%"], avoidLabelOverlap: true, itemStyle: { borderColor: "#111417", borderWidth: 2 }, label: { color: "#d6d4ce", formatter: "{b}\n{d}%", fontSize: 10 }, data: values }],
    color: ["#7890a3", "#3f9b70", "#b58a4d", "#8a728f", "#607d67", "#9a6262", "#8a8f94"],
  }), [values]);
  if (!values.length) return <EmptyState title="No allocation" body="The returned portfolio has no current value." />;
  return <QuantEChart option={option} label="Latest portfolio allocation" />;
}

function TradeTable({ report }: { report: BacktestResponse }) {
  const currency = report.metadata.market === "US" ? "USD" : "INR";
  const columns = useMemo<ColumnDef<TradeRecord>[]>(() => [
    { accessorKey: "time", header: "Date" },
    { accessorKey: "symbol", header: "Symbol" },
    { accessorKey: "side", header: "Side", cell: ({ getValue }) => <span data-side={getValue<string>()}>{getValue<string>()}</span> },
    { accessorKey: "quantity", header: "Quantity", cell: ({ getValue }) => formatNumber(getValue<number>(), 4) },
    { accessorKey: "price", header: "Price", cell: ({ getValue }) => formatMoney(getValue<number>(), currency) },
    { accessorKey: "fee", header: "Fee", cell: ({ getValue }) => formatMoney(getValue<number>(), currency) },
    { accessorKey: "cashEffect", header: "Cash effect", cell: ({ getValue }) => formatMoney(getValue<number>(), currency) },
  ], [currency]);
  return <DataTable data={report.trades} columns={columns} caption="Executed trades for this backtest" fileName="samquant-trades.csv" emptyText="This strategy held cash for the period." />;
}

function SignalTable({ report }: { report: BacktestResponse }) {
  const columns = useMemo<ColumnDef<SignalRecord>[]>(() => [
    { accessorKey: "time", header: "Signal date" },
    { accessorKey: "symbol", header: "Symbol" },
    { accessorKey: "side", header: "Side", cell: ({ getValue }) => <span data-side={getValue<string>()}>{getValue<string>()}</span> },
    { accessorKey: "targetWeight", header: "Target", cell: ({ getValue }) => formatPercent(getValue<number>()) },
  ], []);
  return <DataTable data={report.signals} columns={columns} caption="Strategy signals for this backtest" fileName="samquant-signals.csv" emptyText="No signals were generated." />;
}

function Parameters({ request, report }: { request: BacktestRequest; report: BacktestResponse }) {
  const values = {
    Strategy: report.metadata.strategyLabel,
    Symbols: report.metadata.symbols.join(", "),
    Market: report.metadata.market,
    Period: `${report.metadata.start} to ${report.metadata.end}`,
    "Starting cash": request.initial_cash,
    Commission: `${(request.commission_rate * 100).toFixed(2)}%`,
    Slippage: `${request.slippage_bps} bps`,
    ...report.metadata.parameters,
  };
  return <KeyValueList values={values} />;
}

function Assumptions({ report }: { report: BacktestResponse }) {
  return <KeyValueList values={report.assumptions} />;
}

function KeyValueList({ values }: { values: Record<string, unknown> }) {
  return <dl className={styles.keyValue}>{Object.entries(values).map(([key, value]) => (
    <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>
  ))}</dl>;
}

function StrategyStudy({ report }: { report: BacktestResponse }) {
  const study = report.strategyStudy;
  const trials = study?.trials ?? [];
  const bestByStrategy = study?.bestByStrategy?.length ? study.bestByStrategy : bestTrialForEachStrategy(trials);
  const leader = study?.historicalWinner ?? [...bestByStrategy].sort((left, right) => right.validationReturn - left.validationReturn)[0];
  const columns = useMemo<ColumnDef<StrategyStudyTrial>[]>(() => [
    { accessorKey: "rank", header: "Rank" },
    { accessorKey: "strategy", header: "Strategy" },
    { id: "settings", header: "Settings", accessorFn: (trial) => formatParameters(trial) },
    { accessorKey: "selectionReturn", header: "First 70%", cell: ({ getValue }) => formatPercent(getValue<number>()) },
    { accessorKey: "validationReturn", header: "Final 30%", cell: ({ getValue }) => formatPercent(getValue<number>()) },
    { accessorKey: "fullPeriodReturn", header: "Full period", cell: ({ getValue }) => formatPercent(getValue<number>()) },
    { accessorKey: "maximumDrawdown", header: "Drawdown", cell: ({ getValue }) => formatPercent(getValue<number>()) },
    { accessorKey: "tradeCount", header: "Trades" },
  ], []);
  if (!trials.length || !leader) return <EmptyState title="No parameter study yet" body="Run once to compare the fixed strategy setups." />;
  return <div className={styles.study}>
    <section className={styles.studyLeader}>
      <div><span>Best on the final 30%</span><h3>{leader.strategy}</h3><p>{formatStrategySettings(leader)}</p></div>
      <strong>{formatPercent(leader.validationReturn)}</strong>
    </section>
    <section className={styles.familyStudy}>
      <header><strong>Best settings found for each strategy</strong><span>Same data, dates, and costs.</span></header>
      <div>{bestByStrategy.map((trial) => (
        <article key={trial.strategy} data-winner={trial.strategy === leader.strategy || undefined}>
          <div><strong>{trial.strategy}</strong><span>{formatStrategySettings(trial)}</span></div>
          <dl><div><dt>First 70%</dt><dd>{formatPercent(trial.selectionReturn)}</dd></div><div><dt>Final 30%</dt><dd>{formatPercent(trial.validationReturn)}</dd></div></dl>
        </article>
      ))}</div>
    </section>
    <p className={styles.studyNote}>Settings use earlier prices. Later prices test them. This does not predict the future.</p>
    <DataTable data={trials} columns={columns} caption="Historical strategy parameter study" fileName="samquant-parameter-study.csv" />
  </div>;
}

function ResultReadout({ report }: { report: BacktestResponse }) {
  const currency = report.metadata.market === "US" ? "USD" : "INR";
  const explanation = explainResults(report, currency);
  return <section className={styles.readout} aria-labelledby="result-explanation-heading">
    <header><div><span>Research readout</span><h3 id="result-explanation-heading">What this run actually says</h3></div><strong data-tone={explanation.tone}>{explanation.status}</strong></header>
    <p>{explanation.outcome}</p>
    <dl>
      <div><dt>Against holding</dt><dd>{explanation.comparison}</dd></div>
      <div><dt>Downside</dt><dd>{explanation.risk}</dd></div>
      <div><dt>Sample</dt><dd>{explanation.evidence}</dd></div>
      <div><dt>Last rule</dt><dd>{explanation.decisionBody}</dd></div>
      <div><dt>Next step</dt><dd>{explanation.futureBody}</dd></div>
    </dl>
  </section>;
}

function Limitations({ report }: { report: BacktestResponse }) {
  const warnings = report.warnings.length ? report.warnings : [
    "Historical performance does not predict future returns.",
    "Liquidity and market impact remain simplified.",
    "One test period cannot establish robustness.",
  ];
  return <div className={styles.limitations}>
    <p>Use this run as evidence, not a forecast.</p>
    <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    <Link href="/disclaimer">Full research disclaimer</Link>
  </div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className={styles.emptyState}><Info aria-hidden="true" size={20} /><strong>{title}</strong><span>{body}</span></div>;
}

function WidgetSkeleton() {
  return <div className={styles.widgetSkeleton} role="status" aria-label="Loading chart"><i /><i /><i /><i /></div>;
}

function WidgetLoading() {
  return <div className={styles.widgetLoading} role="status"><span /><strong>Updating widget</strong></div>;
}

function formatParameters(trial: StrategyStudyTrial): string {
  return Object.entries(trial.parameters).map(([key, value]) => `${key.replaceAll("_", " ")} ${String(value)}`).join(" · ");
}

function formatStrategySettings(trial: StrategyStudyTrial): string {
  const parameters = trial.parameters;
  if (trial.strategy === "Moving average crossover") return `Short ${parameters.short_window} days · long ${parameters.long_window} days.`;
  if (trial.strategy === "Mean reversion") return `Entry z-score ${parameters.entry_z_score} · exit z-score ${parameters.exit_z_score} · lookback ${parameters.lookback_window} days.`;
  return `Rebalance every ${parameters.rebalance_frequency} days · lookback ${parameters.lookback_window} days · top ${parameters.top_n}.`;
}

function bestTrialForEachStrategy(trials: StrategyStudyTrial[]): StrategyStudyTrial[] {
  return ["Moving average crossover", "Mean reversion", "Momentum"].map((strategy) => (
    trials.filter((trial) => trial.strategy === strategy).sort((left, right) => right.selectionReturn - left.selectionReturn)[0]
  )).filter((trial): trial is StrategyStudyTrial => Boolean(trial));
}

function sourceLabel(source: BacktestResponse["metadata"]["dataSource"]): string {
  return source === "demo" ? "Demo data" : "Yahoo Finance";
}

function heatmapTooltip(params: unknown, years: string[]): string {
  const value = (params as { value?: [number, number, number] }).value;
  return value ? `${MONTHS[value[0]]} ${years[value[1]]}: ${value[2].toFixed(2)}%` : "";
}

function heatmapLabel(params: unknown): string {
  const value = (params as { value?: [number, number, number] }).value;
  return value ? `${value[2].toFixed(1)}%` : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AXIS_LABEL = { color: "#858e95", fontFamily: "IBM Plex Mono", fontSize: 10 };
const AXIS_LINE = { lineStyle: { color: "#30363b" } };
const SPLIT_LINE = { lineStyle: { color: "#252a2f" } };
const CHART_GRID = { top: 18, right: 20, bottom: 42, left: 56 };
const BASE_ECHART: EChartsOption = {
  backgroundColor: "transparent",
  animationDuration: 280,
  textStyle: { fontFamily: "IBM Plex Sans", color: "#d8d6cf" },
};
