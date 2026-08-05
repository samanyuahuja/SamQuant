import { describe, expect, it } from "vitest";

import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse, TimeValue } from "@/lib/types";
import {
  dailyReturns,
  latestAllocation,
  monthlyReturns,
  rollingVolatility,
} from "@/lib/workspace-analytics";

describe("workspace analytics adapters", () => {
  it("uses only the current and prior equity points for each daily return", () => {
    const equity: TimeValue[] = [
      { time: "2024-01-01", value: 100 },
      { time: "2024-01-02", value: 110 },
      { time: "2024-01-03", value: 99 },
    ];

    const returns = dailyReturns(equity);
    expect(returns.map((point) => point.time)).toEqual(["2024-01-02", "2024-01-03"]);
    expect(returns[0].value).toBeCloseTo(0.1);
    expect(returns[1].value).toBeCloseTo(-0.1);
  });

  it("waits for a complete trailing window before showing volatility", () => {
    const equity = Array.from({ length: 22 }, (_, index) => ({
      time: `2024-01-${String(index + 1).padStart(2, "0")}`,
      value: 100 + index,
    }));

    const values = rollingVolatility(equity, 20);

    expect(values).toHaveLength(2);
    expect(values[0].time).toBe("2024-01-21");
  });

  it("creates one heatmap observation per calendar month", () => {
    const equity: TimeValue[] = [
      { time: "2024-01-02", value: 100 },
      { time: "2024-01-31", value: 110 },
      { time: "2024-02-01", value: 110 },
      { time: "2024-02-29", value: 99 },
    ];

    const values = monthlyReturns(equity).map((point) => point.value);
    expect(values[0]).toBeCloseTo(0.1);
    expect(values[1]).toBeCloseTo(-0.1);
  });

  it("marks positions to market before calculating allocation weights", () => {
    const allocation = latestAllocation(demoReport as BacktestResponse);
    const total = allocation.reduce((sum, item) => sum + item.value, 0);

    expect(total).toBeCloseTo(1);
    expect(allocation.every((item) => item.value >= 0)).toBe(true);
  });
});
