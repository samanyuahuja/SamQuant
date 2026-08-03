import { describe, expect, it } from "vitest";

import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse } from "./types";
import { explainResults } from "./explain-results";

describe("explainResults", () => {
  it("turns the demo result into clear, evidence-based language", () => {
    const explanation = explainResults(demoReport as BacktestResponse, "USD");

    expect(explanation.status).toBe("Loss in this test");
    expect(explanation.outcome).toContain("started with $100,000");
    expect(explanation.outcome).toContain("lost 0.8%");
    expect(explanation.comparison).toContain("trailed the equal-weight benchmark by 35.8 percentage points");
    expect(explanation.risk).toContain("largest fall from an earlier high was 12.0%");
    expect(explanation.evidence).toContain("Only 5 trades were executed");
    expect(explanation.decisionTitle).toBe("The old test ended holding AAPL.");
    expect(explanation.decisionBody).toContain("last historical signal was BUY for AAPL on Dec 12, 2023");
    expect(explanation.futureBody).toContain("cannot see prices after that day");
  });

  it("does not invent a trade instruction when no signals were produced", () => {
    const report: BacktestResponse = {
      ...(demoReport as BacktestResponse),
      metadata: { ...(demoReport as BacktestResponse).metadata, end: "2024-06-28" },
      metrics: {
        ...(demoReport as BacktestResponse).metrics,
        totalReturn: 0.2,
        finalValue: 120_000,
        tradeCount: 0,
        winRate: null,
      },
      benchmarkMetrics: {
        ...(demoReport as BacktestResponse).benchmarkMetrics,
        totalReturn: 0.1,
      },
      signals: [],
      portfolio: {
        ...(demoReport as BacktestResponse).portfolio,
        positions: { AAPL: [{ time: "2024-06-28", value: 0 }] },
      },
    };

    const explanation = explainResults(report, "USD");

    expect(explanation.status).toBe("Gain in this test");
    expect(explanation.comparison).toContain("beat the equal-weight benchmark by 10.0 percentage points");
    expect(explanation.evidence).toContain("made no trades");
    expect(explanation.decisionTitle).toBe("The old test ended in cash.");
    expect(explanation.decisionBody).toContain("No buy or sell signal appeared");
    expect(explanation.decisionBody).not.toContain("instruction to buy");
  });
});
