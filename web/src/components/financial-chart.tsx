"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
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
    const chart = createBaseChart(container.current);
    if (mode === "price") addPriceSeries(chart, report);
    if (mode === "performance") addEquitySeries(chart, report.portfolio.equity);
    if (mode === "drawdown") addDrawdownSeries(chart, report.portfolio.drawdown);
    if (mode === "comparison") addComparisonSeries(chart, report);
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

function createBaseChart(container: HTMLDivElement): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    autoSize: false,
    layout: {
      background: { type: ColorType.Solid, color: "#10100f" },
      textColor: "#92938f",
      fontFamily: "SFMono-Regular, Consolas, monospace",
      fontSize: 11,
      attributionLogo: true,
    },
    grid: {
      vertLines: { color: "#222320" },
      horzLines: { color: "#222320" },
    },
    crosshair: {
      vertLine: { color: "#646561", labelBackgroundColor: "#292a27" },
      horzLine: { color: "#646561", labelBackgroundColor: "#292a27" },
    },
    rightPriceScale: { borderColor: "#292a27" },
    timeScale: { borderColor: "#292a27", timeVisible: false },
    handleScale: true,
    handleScroll: true,
  });
}

function addPriceSeries(chart: IChartApi, report: BacktestResponse) {
  const symbol = report.metadata.symbols[0];
  const bars = report.market[symbol];
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: "#5bc28a",
    downColor: "#e16d64",
    borderVisible: false,
    wickUpColor: "#5bc28a",
    wickDownColor: "#e16d64",
  });
  candles.setData(bars.map((bar) => ({
    time: bar.time as Time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })));

  const colors = ["#b9d66b", "#e3b75e", "#8faaa8"];
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
      color: trade.side === "BUY" ? "#5bc28a" : "#e16d64",
      shape: trade.side === "BUY" ? "arrowUp" : "arrowDown",
      text: trade.side,
    }));
  createSeriesMarkers(candles, markers);
}

function addEquitySeries(chart: IChartApi, values: TimeValue[]) {
  const series = chart.addSeries(AreaSeries, {
    lineColor: "#b9d66b",
    topColor: "rgba(185, 214, 107, 0.22)",
    bottomColor: "rgba(185, 214, 107, 0.01)",
    lineWidth: 2,
    priceFormat: { type: "price", precision: 0, minMove: 1 },
  });
  series.setData(toLineData(values));
}

function addDrawdownSeries(chart: IChartApi, values: TimeValue[]) {
  const series = chart.addSeries(AreaSeries, {
    lineColor: "#e16d64",
    topColor: "rgba(225, 109, 100, 0.02)",
    bottomColor: "rgba(225, 109, 100, 0.28)",
    lineWidth: 2,
    priceFormat: { type: "percent", precision: 1, minMove: 0.1 },
  });
  series.setData(toLineData(values, 100));
}

function addComparisonSeries(chart: IChartApi, report: BacktestResponse) {
  const strategy = chart.addSeries(LineSeries, {
    color: "#b9d66b",
    lineWidth: 2,
    title: report.metadata.strategyLabel,
  });
  const benchmark = chart.addSeries(LineSeries, {
    color: "#92938f",
    lineWidth: 2,
    lineStyle: 2,
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
