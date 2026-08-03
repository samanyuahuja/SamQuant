"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  LineSeries,
  type IChartApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";

import type { BacktestResponse, TimeValue } from "@/lib/types";
import styles from "./financial-chart.module.css";

export type ChartMode = "price" | "performance" | "drawdown" | "comparison";

export function FinancialChart({
  report,
  mode,
}: {
  report: BacktestResponse;
  mode: ChartMode;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const theme = readTheme(container.current);
    const chart = createBaseChart(container.current, theme);
    if (mode === "price") addPriceSeries(chart, report, theme);
    if (mode === "performance") addEquitySeries(chart, report.portfolio.equity, theme);
    if (mode === "drawdown") addDrawdownSeries(chart, report.portfolio.drawdown, theme);
    if (mode === "comparison") addComparisonSeries(chart, report, theme);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [mode, report]);

  const summary = chartSummary(report, mode);
  return (
    <figure className={styles.figure} aria-label={summary}>
      <div ref={container} className={styles.chart} />
      <figcaption className={styles.caption}>{summary}</figcaption>
    </figure>
  );
}

interface ChartTheme {
  background: string;
  text: string;
  grid: string;
  crosshair: string;
  crosshairLabel: string;
  border: string;
  accent: string;
  accentSecondary: string;
  positive: string;
  negative: string;
}

function readTheme(container: HTMLDivElement): ChartTheme {
  const computed = getComputedStyle(container);
  const read = (name: string, fallback: string) => computed.getPropertyValue(name).trim() || fallback;
  return {
    background: read("--chart-background", "#fffdf8"),
    text: read("--chart-text", "#657069"),
    grid: read("--chart-grid", "#e8e2d6"),
    crosshair: read("--chart-crosshair", "#7f8983"),
    crosshairLabel: read("--chart-crosshair-label", "#315f69"),
    border: read("--chart-border", "#cbc7bd"),
    accent: read("--chart-accent", "#315f69"),
    accentSecondary: read("--chart-accent-secondary", "#92713a"),
    positive: read("--chart-positive", "#21674c"),
    negative: read("--chart-negative", "#a8473d"),
  };
}

function createBaseChart(container: HTMLDivElement, theme: ChartTheme): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    autoSize: false,
    layout: {
      background: { type: ColorType.Solid, color: theme.background },
      textColor: theme.text,
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: 11,
      attributionLogo: true,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      vertLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshairLabel },
      horzLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshairLabel },
    },
    rightPriceScale: { borderColor: theme.border },
    timeScale: { borderColor: theme.border, timeVisible: false },
    handleScale: true,
    handleScroll: true,
  });
}

function addPriceSeries(chart: IChartApi, report: BacktestResponse, theme: ChartTheme) {
  const symbol = report.metadata.symbols[0];
  const bars = report.market[symbol];
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: theme.positive,
    downColor: theme.negative,
    borderVisible: false,
    wickUpColor: theme.positive,
    wickDownColor: theme.negative,
  });
  candles.setData(bars.map((bar) => ({
    time: bar.time as Time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })));

  const colors = [theme.accent, theme.accentSecondary, theme.text];
  Object.entries(report.indicators).forEach(([name, symbols], index) => {
    if (name === "z_score" || name === "trailing_return") return;
    const series = chart.addSeries(LineSeries, {
      color: colors[index % colors.length],
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.setData(
      (symbols[symbol] ?? []).flatMap((point) =>
        point.value === null ? [] : [{ time: point.time as Time, value: point.value }],
      ),
    );
  });

  const markers: SeriesMarker<Time>[] = report.trades
    .filter((trade) => trade.symbol === symbol)
    .map((trade) => ({
      time: trade.time as Time,
      position: trade.side === "BUY" ? "belowBar" : "aboveBar",
      color: trade.side === "BUY" ? theme.positive : theme.negative,
      shape: trade.side === "BUY" ? "arrowUp" : "arrowDown",
      text: trade.side,
    }));
  createSeriesMarkers(candles, markers);
}

function addEquitySeries(chart: IChartApi, values: TimeValue[], theme: ChartTheme) {
  const series = chart.addSeries(AreaSeries, {
    lineColor: theme.accent,
    topColor: "rgba(49, 95, 105, 0.20)",
    bottomColor: "rgba(49, 95, 105, 0.02)",
    lineWidth: 2,
    priceFormat: { type: "price", precision: 0, minMove: 1 },
  });
  series.setData(toLineData(values));
}

function addDrawdownSeries(chart: IChartApi, values: TimeValue[], theme: ChartTheme) {
  const series = chart.addSeries(AreaSeries, {
    lineColor: theme.negative,
    topColor: "rgba(168, 71, 61, 0.02)",
    bottomColor: "rgba(168, 71, 61, 0.20)",
    lineWidth: 2,
    priceFormat: { type: "percent", precision: 1, minMove: 0.1 },
  });
  series.setData(toLineData(values, 100));
}

function addComparisonSeries(chart: IChartApi, report: BacktestResponse, theme: ChartTheme) {
  const strategy = chart.addSeries(LineSeries, {
    color: theme.accent,
    lineWidth: 2,
    title: report.metadata.strategyLabel,
  });
  const benchmark = chart.addSeries(LineSeries, {
    color: theme.text,
    lineWidth: 2,
    lineStyle: LineStyle.Dashed,
    title: "Equal-weight benchmark",
  });
  strategy.setData(normalize(report.portfolio.equity));
  benchmark.setData(normalize(report.portfolio.benchmark));
}

function normalize(values: TimeValue[]) {
  const start = values.find((point) => point.value !== null)?.value ?? 1;
  return values.flatMap((point) => point.value === null
    ? []
    : [{ time: point.time as Time, value: (point.value / start) * 100 }]);
}

function toLineData(values: TimeValue[], multiplier = 1) {
  return values.flatMap((point) => point.value === null
    ? []
    : [{ time: point.time as Time, value: point.value * multiplier }]);
}

function chartSummary(report: BacktestResponse, mode: ChartMode): string {
  const symbol = report.metadata.symbols[0];
  if (mode === "price") {
    return `${symbol} daily candlesticks with strategy indicators and ${report.trades.length} executed trade markers.`;
  }
  if (mode === "drawdown") {
    return `Portfolio drawdown over time. Maximum drawdown was ${percent(report.metrics.maximumDrawdown)}.`;
  }
  if (mode === "comparison") {
    return `${report.metadata.strategyLabel} performance compared with the equal-weight benchmark.`;
  }
  return `Portfolio equity over time, ending at ${Math.round(report.metrics.finalValue).toLocaleString("en-US")}.`;
}

function percent(value: number | null): string {
  return value === null ? "not available" : `${(value * 100).toFixed(1)} percent`;
}
