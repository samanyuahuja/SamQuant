import { describe, expect, it } from "vitest";

import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse } from "./types";
import { explainResults } from "./explain-results";

describe("explainResults", () => {
  it("turns the demo result into clear, evidence-based language", () => {
    const explanation = explainResults(demoReport as BacktestResponse, "USD");

    expect(explanation.status).toBe("Finished behind");
    expect(explanation.outcome).toContain("$100,000");
    expect(explanation.outcome).toContain("3.6% loss");
    expect(explanation.comparison).toContain("Equal-weight holding finished 35.2 percentage points ahead");
    expect(explanation.risk).toContain("worst fall from a previous high was 12.2%");
    expect(explanation.evidence).toContain("5 trades is a thin sample");
    expect(explanation.decisionTitle).toBe("Ended holding AAPL.");
    expect(explanation.decisionBody).toContain("BUY AAPL on Dec 11, 2023");
    expect(explanation.futureBody).toContain("record stops on");
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

    expect(explanation.status).toBe("Finished ahead");
    expect(explanation.comparison).toContain("rules finished 10.0 percentage points ahead");
    expect(explanation.evidence).toContain("No trades were made");
    expect(explanation.decisionTitle).toBe("Ended in cash.");
    expect(explanation.decisionBody).toContain("No buy or sell rule fired");
    expect(explanation.decisionBody).not.toContain("instruction to buy");
  });
});
