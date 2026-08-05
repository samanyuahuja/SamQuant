import type { BacktestResponse, TimeValue } from "@/lib/types";

export interface DatedValue {
  time: string;
  value: number;
}

export interface MonthlyReturn {
  year: string;
  month: number;
  value: number;
}

export interface HistogramBin {
  label: string;
  value: number;
}

export function dailyReturns(equity: TimeValue[]): DatedValue[] {
  const values = equity.filter((point): point is { time: string; value: number } => point.value !== null);
  return values.slice(1).flatMap((point, index) => {
    const previous = values[index].value;
    if (previous === 0) return [];
    return [{ time: point.time, value: point.value / previous - 1 }];
  });
}

export function rollingVolatility(equity: TimeValue[], window = 20): DatedValue[] {
  return rollingWindows(dailyReturns(equity), window).map(({ time, values }) => ({
    time,
    value: standardDeviation(values) * Math.sqrt(252),
  }));
}

export function rollingSharpe(equity: TimeValue[], window = 20): DatedValue[] {
  return rollingWindows(dailyReturns(equity), window).map(({ time, values }) => {
    const deviation = standardDeviation(values);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { time, value: deviation === 0 ? 0 : (mean / deviation) * Math.sqrt(252) };
  });
}

export function monthlyReturns(equity: TimeValue[]): MonthlyReturn[] {
  const values = equity.filter((point): point is { time: string; value: number } => point.value !== null);
  const months = new Map<string, { first: number; last: number }>();
  for (const point of values) {
    const key = point.time.slice(0, 7);
    const current = months.get(key);
    months.set(key, { first: current?.first ?? point.value, last: point.value });
  }
  return [...months.entries()].map(([key, value]) => ({
    year: key.slice(0, 4),
    month: Number(key.slice(5, 7)) - 1,
    value: value.first === 0 ? 0 : value.last / value.first - 1,
  }));
}

export function returnHistogram(equity: TimeValue[], binCount = 12): HistogramBin[] {
  const values = dailyReturns(equity).map((point) => point.value * 100);
  if (!values.length) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  const bins = Array.from({ length: binCount }, () => 0);
  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor(((value - minimum) / span) * binCount));
    bins[index] += 1;
  }
  return bins.map((value, index) => {
    const start = minimum + (span * index) / binCount;
    const end = minimum + (span * (index + 1)) / binCount;
    return { label: `${start.toFixed(1)} to ${end.toFixed(1)}`, value };
  });
}

export function latestAllocation(report: BacktestResponse): { name: string; value: number }[] {
  const positionValues = Object.entries(report.portfolio.positions).map(([symbol, series]) => ({
    name: symbol,
    value: Math.max(0, lastValue(series) * lastMarketClose(report, symbol)),
  }));
  const cash = Math.max(0, lastValue(report.portfolio.cash));
  const raw = [...positionValues, { name: "Cash", value: cash }].filter((item) => item.value > 0);
  const total = raw.reduce((sum, item) => sum + item.value, 0);
  return total === 0 ? [] : raw.map((item) => ({ ...item, value: item.value / total }));
}

function lastMarketClose(report: BacktestResponse, symbol: string): number {
  const bars = report.market[symbol] ?? [];
  return bars.at(-1)?.close ?? 0;
}

function lastValue(values: TimeValue[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index].value;
    if (value !== null) return value;
  }
  return 0;
}

function rollingWindows(values: DatedValue[], window: number) {
  return values.slice(window - 1).map((point, index) => ({
    time: point.time,
    values: values.slice(index, index + window).map((value) => value.value),
  }));
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
