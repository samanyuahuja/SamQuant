import { describe, expect, it } from "vitest";

import type { BacktestResponse } from "@/lib/types";
import { calculateAssetAttribution } from "./asset-attribution";

function reportFixture(): BacktestResponse {
  return {
    metadata: { symbols: ["AAPL", "MSFT"] },
    market: {
      AAPL: [
        { time: "2024-01-01", open: 100, high: 100, low: 100, close: 100, volume: 1 },
        { time: "2024-01-02", open: 110, high: 110, low: 110, close: 110, volume: 1 },
      ],
      MSFT: [
        { time: "2024-01-01", open: 50, high: 50, low: 50, close: 50, volume: 1 },
        { time: "2024-01-02", open: 45, high: 45, low: 45, close: 45, volume: 1 },
      ],
    },
    portfolio: {
      positions: {
        AAPL: [{ time: "2024-01-02", value: 5 }],
        MSFT: [{ time: "2024-01-02", value: 10 }],
      },
      equity: [{ time: "2024-01-01", value: 1_000 }],
    },
    trades: [
      { symbol: "AAPL", cashEffect: -500 },
      { symbol: "MSFT", cashEffect: -500 },
    ],
    metrics: { totalReturn: 0, finalValue: 1_000 },
  } as unknown as BacktestResponse;
}

describe("calculateAssetAttribution", () => {
  it("ranks assets by net strategy P&L", () => {
    const rows = calculateAssetAttribution(reportFixture());

    expect(rows.map((row) => row.symbol)).toEqual(["AAPL", "MSFT"]);
    expect(rows[0]).toMatchObject({ rank: 1, netPnl: 50, endingValue: 550, selected: true });
    expect(rows[1]).toMatchObject({ rank: 2, netPnl: -50, endingValue: 450, selected: true });
  });

  it("separates raw stock returns from portfolio contribution", () => {
    const rows = calculateAssetAttribution(reportFixture());

    expect(rows[0].periodReturn).toBeCloseTo(0.1);
    expect(rows[0].returnContribution).toBeCloseTo(0.05);
    expect(rows[0].portfolioWeight).toBeCloseTo(0.55);
    expect(rows[1].periodReturn).toBeCloseTo(-0.1);
    expect(rows[1].returnContribution).toBeCloseTo(-0.05);
    expect(rows[1].portfolioWeight).toBeCloseTo(0.45);
  });
});
