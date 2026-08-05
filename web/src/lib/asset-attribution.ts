import type { BacktestResponse, TimeValue } from "@/lib/types";

export interface AssetAttribution {
  rank: number;
  symbol: string;
  selected: boolean;
  periodReturn: number | null;
  finalPrice: number;
  netPnl: number;
  returnContribution: number | null;
  endingValue: number;
  portfolioWeight: number | null;
}

export function calculateAssetAttribution(report: BacktestResponse): AssetAttribution[] {
  const initialValue = inferInitialValue(report);
  const rows = report.metadata.symbols.map((symbol) => {
    const bars = report.market[symbol] ?? [];
    const firstPrice = bars[0]?.close ?? 0;
    const finalPrice = bars.at(-1)?.close ?? 0;
    const endingQuantity = lastValue(report.portfolio.positions[symbol] ?? []) ?? 0;
    const endingValue = endingQuantity * finalPrice;
    const tradeCashFlow = report.trades
      .filter((trade) => trade.symbol === symbol)
      .reduce((total, trade) => total + trade.cashEffect, 0);
    const netPnl = tradeCashFlow + endingValue;

    return {
      rank: 0,
      symbol,
      selected: Math.abs(endingQuantity) > 1e-10,
      periodReturn: firstPrice > 0 ? finalPrice / firstPrice - 1 : null,
      finalPrice,
      netPnl,
      returnContribution: initialValue > 0 ? netPnl / initialValue : null,
      endingValue,
      portfolioWeight: report.metrics.finalValue > 0
        ? endingValue / report.metrics.finalValue
        : null,
    };
  });

  return rows
    .sort((left, right) => right.netPnl - left.netPnl || left.symbol.localeCompare(right.symbol))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function inferInitialValue(report: BacktestResponse): number {
  const totalReturn = report.metrics.totalReturn;
  if (totalReturn !== null && 1 + totalReturn > 1e-10) {
    return report.metrics.finalValue / (1 + totalReturn);
  }
  return lastValue(report.portfolio.equity.slice(0, 1)) ?? 0;
}

function lastValue(values: TimeValue[]): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]?.value;
    if (value !== null && value !== undefined) return value;
  }
  return null;
}
