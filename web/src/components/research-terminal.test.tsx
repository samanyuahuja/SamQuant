import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse } from "@/lib/types";
import { ResearchTerminal } from "./research-terminal";

vi.mock("@/components/financial-chart", () => ({
  FinancialChart: ({ mode }: { mode: string }) => <div data-testid={`chart-${mode}`} />,
}));

describe("ResearchTerminal", () => {
  afterEach(() => vi.restoreAllMocks());

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
  });

  it("rejects an empty ticker list before making a request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.change(screen.getByLabelText("Tickers"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Run backtest" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter at least one ticker symbol");
    await waitFor(() => expect(screen.getByLabelText("Tickers")).toHaveFocus());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a useful backend failure without leaking server details", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: { code: "API_UNAVAILABLE", message: "The research engine is unavailable. Check the Python API and try again.", fields: [], requestId: "test" },
    }), { status: 503, headers: { "content-type": "application/json" } }));
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.click(screen.getByRole("button", { name: "Run backtest" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("research engine is unavailable"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("ECONNREFUSED");
  });

  it("lets small screens collapse the control flow", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);
    const toggle = screen.getByRole("button", { name: /Hide/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the executed trade table", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.click(screen.getByRole("tab", { name: /Trades/ }));

    expect(screen.getByRole("table", { name: "Executed trades for this backtest" })).toBeInTheDocument();
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
  });
});
