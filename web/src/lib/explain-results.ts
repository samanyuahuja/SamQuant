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
      ? `The old test ended holding ${formatList(heldSymbols)}.`
      : "The old test ended in cash.",
    decisionBody: explainHistoricalSignal(latestSignal),
    futureTitle: "This does not predict the next move.",
    futureBody: `This test stops on ${formatDate(report.metadata.end)}. It cannot see prices after that day. Run the same rules on newer data and on a separate period before treating the pattern as useful.`,
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
  if (totalReturn === null) return { label: "Return unavailable", tone: "unknown" };
  if (Math.abs(totalReturn) < 0.0005) return { label: "Almost unchanged", tone: "flat" };
  return totalReturn > 0
    ? { label: "Gain in this test", tone: "gain" }
    : { label: "Loss in this test", tone: "loss" };
}

function explainOutcome(
  initialValue: number,
  finalValue: number,
  totalReturn: number | null,
  currency: string,
): string {
  const values = `The account started with ${formatMoney(initialValue, currency)} and ended with ${formatMoney(finalValue, currency)}.`;
  if (totalReturn === null) return `${values} There was not enough information to calculate the full return.`;
  if (Math.abs(totalReturn) < 0.0005) return `${values} It finished almost where it started.`;
  const direction = totalReturn > 0 ? "gained" : "lost";
  return `${values} It ${direction} ${formatPercent(Math.abs(totalReturn))} during this test.`;
}

function explainComparison(
  strategyReturn: number | null,
  benchmarkReturn: number | null,
): string {
  if (strategyReturn === null || benchmarkReturn === null) {
    return "There was not enough information to compare the strategy with the equal-weight benchmark.";
  }
  const difference = strategyReturn - benchmarkReturn;
  if (Math.abs(difference) < 0.001) {
    return "The strategy and the equal-weight benchmark finished at about the same return.";
  }
  const points = `${(Math.abs(difference) * 100).toFixed(1)} percentage points`;
  if (difference > 0) {
    return `The strategy beat the equal-weight benchmark by ${points}. The trading rules worked better than simply holding the selected assets in this period.`;
  }
  return `The strategy trailed the equal-weight benchmark by ${points}. Simply holding the selected assets worked better in this period.`;
}

function explainRisk(maximumDrawdown: number | null, sharpeRatio: number | null): string {
  const drawdown = maximumDrawdown === null
    ? "The largest fall from an earlier high could not be calculated."
    : `The largest fall from an earlier high was ${formatPercent(maximumDrawdown)}.`;
  if (sharpeRatio === null) return `${drawdown} There was not enough information to compare return with risk.`;
  if (sharpeRatio >= 1) return `${drawdown} In this test, the return was strong compared with the measured ups and downs.`;
  if (sharpeRatio >= 0.5) return `${drawdown} In this test, the return partly made up for the measured ups and downs.`;
  if (sharpeRatio >= 0) return `${drawdown} The return was small compared with the measured ups and downs.`;
  return `${drawdown} The return was below the risk-free comparison after considering the measured ups and downs.`;
}

function explainEvidence(tradeCount: number, winRate: number | null): string {
  let evidence: string;
  if (tradeCount === 0) {
    evidence = "The rules made no trades, so this period cannot tell us much about their trading behavior.";
  } else if (tradeCount < 10) {
    evidence = `Only ${tradeCount} trades were executed. That is too little evidence for a strong conclusion because one trade can change the result a lot.`;
  } else if (tradeCount < 30) {
    evidence = `${tradeCount} trades were executed. This offers some evidence, but the result can still depend heavily on a few trades.`;
  } else {
    evidence = `${tradeCount} trades were executed. That is more useful evidence, but it still covers only this market and time period.`;
  }
  if (winRate === null) return evidence;
  return `${evidence} ${formatPercent(winRate)} of completed trades made money, but win rate does not show how large each gain or loss was.`;
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
    return "No buy or sell signal appeared in this period. That does not tell us what the market will do next.";
  }
  return `Its last historical signal was ${signal.side} for ${signal.symbol} on ${formatDate(signal.time)}. That was a rule inside this past simulation, not an instruction to trade today.`;
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
