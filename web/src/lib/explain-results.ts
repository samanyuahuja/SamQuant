import { formatMoney, formatPercent } from "./format";
import type { BacktestResponse } from "./types";

export type ResultTone = "gain" | "loss" | "flat" | "unknown";

export interface ResultExplanation {
  status: string;
  tone: ResultTone;
  outcome: string;
  comparison: string;
  risk: string;
  evidence: string;
  decisionTitle: string;
  decisionBody: string;
  futureTitle: string;
  futureBody: string;
}

export function explainResults(
  report: BacktestResponse,
  currency: string,
): ResultExplanation {
  const totalReturn = report.metrics.totalReturn;
  const initialValue = findInitialValue(report);
  const status = resultStatus(totalReturn);
  const heldSymbols = currentHoldings(report);
  const latestSignal = findLatestSignal(report);

  return {
    status: status.label,
    tone: status.tone,
    outcome: explainOutcome(initialValue, report.metrics.finalValue, totalReturn, currency),
    comparison: explainComparison(totalReturn, report.benchmarkMetrics.totalReturn),
    risk: explainRisk(report.metrics.maximumDrawdown, report.metrics.sharpeRatio),
    evidence: explainEvidence(report.metrics.tradeCount, report.metrics.winRate),
    decisionTitle: heldSymbols.length
      ? `Ended holding ${formatList(heldSymbols)}.`
      : "Ended in cash.",
    decisionBody: explainHistoricalSignal(latestSignal),
    futureTitle: "Check it on unseen data.",
    futureBody: `The record stops on ${formatDate(report.metadata.end)}. Try the same rules on another period before trusting the pattern. A strong fit here can still fail later.`,
  };
}

function findInitialValue(report: BacktestResponse): number {
  const firstValue = report.portfolio.equity.find((point) => point.value !== null)?.value;
  if (firstValue !== null && firstValue !== undefined) return firstValue;
  const totalReturn = report.metrics.totalReturn;
  if (totalReturn !== null && totalReturn > -1) {
    return report.metrics.finalValue / (1 + totalReturn);
  }
  return report.metrics.finalValue;
}

function resultStatus(totalReturn: number | null): { label: string; tone: ResultTone } {
  if (totalReturn === null) return { label: "No return figure", tone: "unknown" };
  if (Math.abs(totalReturn) < 0.0005) return { label: "Finished flat", tone: "flat" };
  return totalReturn > 0
    ? { label: "Finished ahead", tone: "gain" }
    : { label: "Finished behind", tone: "loss" };
}

function explainOutcome(
  initialValue: number,
  finalValue: number,
  totalReturn: number | null,
  currency: string,
): string {
  const values = `${formatMoney(initialValue, currency)} became ${formatMoney(finalValue, currency)}.`;
  if (totalReturn === null) return `${values} The full return could not be calculated.`;
  if (Math.abs(totalReturn) < 0.0005) return `${values} The account barely moved.`;
  const direction = totalReturn > 0 ? "gain" : "loss";
  return `${values} That is a ${formatPercent(Math.abs(totalReturn))} ${direction} over the dates shown.`;
}

function explainComparison(
  strategyReturn: number | null,
  benchmarkReturn: number | null,
): string {
  if (strategyReturn === null || benchmarkReturn === null) {
    return "The run does not contain enough data for a fair benchmark comparison.";
  }
  const difference = strategyReturn - benchmarkReturn;
  if (Math.abs(difference) < 0.001) {
    return "The rules and equal-weight holding finished at roughly the same return.";
  }
  const points = `${(Math.abs(difference) * 100).toFixed(1)} percentage points`;
  if (difference > 0) {
    return `The rules finished ${points} ahead of equal-weight holding in this period.`;
  }
  return `Equal-weight holding finished ${points} ahead of the rules in this period.`;
}

function explainRisk(maximumDrawdown: number | null, sharpeRatio: number | null): string {
  const drawdown = maximumDrawdown === null
    ? "The peak-to-trough fall could not be calculated."
    : `The worst fall from a previous high was ${formatPercent(maximumDrawdown)}.`;
  if (sharpeRatio === null) return `${drawdown} Risk-adjusted return is unavailable.`;
  if (sharpeRatio >= 1) return `${drawdown} Return was strong relative to the measured volatility.`;
  if (sharpeRatio >= 0.5) return `${drawdown} Return partly compensated for the measured volatility.`;
  if (sharpeRatio >= 0) return `${drawdown} Return was weak relative to the measured volatility.`;
  return `${drawdown} Risk-adjusted return was below the risk-free comparison.`;
}

function explainEvidence(tradeCount: number, winRate: number | null): string {
  let evidence: string;
  if (tradeCount === 0) {
    evidence = "No trades were made, so this period says little about the rules.";
  } else if (tradeCount < 10) {
    evidence = `${tradeCount} trades is a thin sample. One trade can change the result sharply.`;
  } else if (tradeCount < 30) {
    evidence = `${tradeCount} trades gives some evidence, though a few trades may still drive the result.`;
  } else {
    evidence = `${tradeCount} trades is a more useful sample, but it still covers one market window.`;
  }
  if (winRate === null) return evidence;
  return `${evidence} The win rate was ${formatPercent(winRate)}; it says nothing about the size of wins and losses.`;
}

function currentHoldings(report: BacktestResponse): string[] {
  return report.metadata.symbols.filter((symbol) => {
    const values = report.portfolio.positions[symbol] ?? [];
    const lastValue = [...values].reverse().find((point) => point.value !== null)?.value ?? 0;
    return Math.abs(lastValue) > 1e-9;
  });
}

function findLatestSignal(report: BacktestResponse): BacktestResponse["signals"][number] | null {
  return report.signals.reduce<BacktestResponse["signals"][number] | null>(
    (latest, signal) => !latest || signal.time > latest.time ? signal : latest,
    null,
  );
}

function explainHistoricalSignal(
  signal: BacktestResponse["signals"][number] | null,
): string {
  if (!signal) {
    return "No buy or sell rule fired in this period.";
  }
  return `${signal.side} ${signal.symbol} on ${formatDate(signal.time)}. That is the last recorded rule, not a trade for today.`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatList(values: string[]): string {
  if (values.length < 2) return values[0] ?? "nothing";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
