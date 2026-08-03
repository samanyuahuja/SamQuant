import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse } from "@/lib/types";
import { ResearchTerminal } from "./research-terminal";

vi.mock("@/components/financial-chart", () => ({
  FinancialChart: ({ mode }: { mode: string }) => <div data-testid={`chart-${mode}`} />,
}));

describe("ResearchTerminal", () => {
  it("shows an actual deterministic result and all research tabs", async () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    expect(screen.getByRole("heading", { name: "Moving average crossover" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Performance/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Trades/ })).toBeInTheDocument();
    expect(await screen.findByTestId("chart-price")).toBeInTheDocument();
  });

  it("catches invalid dates before making a network request", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.change(screen.getByLabelText("Start", { exact: true }), { target: { value: "2024-02-01" } });
    fireEvent.change(screen.getByLabelText("End", { exact: true }), { target: { value: "2024-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Run backtest" }));

    expect(screen.getByRole("alert")).toHaveTextContent("End date must be later than start date");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("opens the executed trade table", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.click(screen.getByRole("tab", { name: /Trades/ }));

    expect(screen.getByRole("table", { name: "Executed trades for this backtest" })).toBeInTheDocument();
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
  });
});
