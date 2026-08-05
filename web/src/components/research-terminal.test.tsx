import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse } from "@/lib/types";
import { ResearchTerminal } from "./research-terminal";

vi.mock("@/components/financial-chart", () => ({
  FinancialChart: ({ mode, symbol }: { mode: string; symbol?: string }) => <div data-testid={`chart-${mode}`} data-symbol={symbol} />,
}));

function reportWithSymbols(symbols: string[]): BacktestResponse {
  const base = demoReport as BacktestResponse;
  return {
    ...base,
    metadata: { ...base.metadata, symbols },
    market: Object.fromEntries(symbols.map((symbol) => [symbol, base.market.AAPL])),
  };
}

function momentumAttributionReport(): BacktestResponse {
  const base = reportWithSymbols(["AAPL", "MSFT", "NVDA"]);
  return {
    ...base,
    metadata: { ...base.metadata, strategy: "momentum", strategyLabel: "Momentum" },
    portfolio: {
      ...base.portfolio,
      positions: {
        AAPL: [{ time: "2024-01-03", value: 10 }],
        MSFT: [{ time: "2024-01-03", value: 0 }],
        NVDA: [{ time: "2024-01-03", value: 8 }],
      },
    },
    trades: [
      { ...base.trades[0], symbol: "AAPL", cashEffect: -1_000 },
      { ...base.trades[0], symbol: "NVDA", cashEffect: -800 },
    ],
  };
}

describe("ResearchTerminal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an actual deterministic result and all research tabs", async () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    expect(screen.getByRole("heading", { name: "Moving average crossover" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What this run actually says" })).toBeInTheDocument();
    expect(screen.getByText("Finished behind")).toBeInTheDocument();
    expect(screen.getByText(/BUY AAPL on/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Performance/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Trades/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Parameter study/ })).toBeInTheDocument();
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

  it("preserves commas while entering a multi-asset universe", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(demoReport), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);
    const tickerInput = screen.getByLabelText("Tickers");

    fireEvent.change(tickerInput, { target: { value: "AAPL," } });
    expect(tickerInput).toHaveValue("AAPL,");
    fireEvent.change(tickerInput, { target: { value: "AAPL, MSFT" } });
    fireEvent.click(screen.getByRole("button", { name: "Run backtest" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.symbols).toEqual(["AAPL", "MSFT"]);
  });

  it("switches the displayed ticker without changing the combined portfolio", () => {
    render(<ResearchTerminal initialReport={reportWithSymbols(["AAPL", "MSFT"])} />);

    const selector = screen.getByRole("group", { name: "Chart ticker" });
    expect(within(selector).getByRole("button", { name: "AAPL" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("chart-price")).toHaveAttribute("data-symbol", "AAPL");
    expect(screen.getByText("2 assets · 5 fills")).toBeInTheDocument();

    fireEvent.click(within(selector).getByRole("button", { name: "MSFT" }));

    expect(screen.getByRole("heading", { name: "MSFT daily bars" })).toBeInTheDocument();
    expect(screen.getByTestId("chart-price")).toHaveAttribute("data-symbol", "MSFT");
    expect(screen.getByText("Twenty most recent MSFT price bars shown in the chart")).toBeInTheDocument();
  });

  it("applies momentum top assets to the complete ticker universe", async () => {
    const response = reportWithSymbols(["AAPL", "MSFT", "NVDA"]);
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.change(screen.getByLabelText("Tickers"), { target: { value: "AAPL, MSFT, NVDA" } });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "momentum" } });
    const topAssets = screen.getByLabelText("Top assets (of 3)");
    expect(topAssets).toHaveAttribute("max", "3");

    fireEvent.change(topAssets, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Run backtest" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.symbols).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(body.strategy).toBe("momentum");
    expect(body.parameters.top_n).toBe(2);
  });

  it("names momentum holdings and ranks every input asset", () => {
    render(<ResearchTerminal initialReport={momentumAttributionReport()} />);

    expect(screen.getByText("Latest selection")).toBeInTheDocument();
    expect(screen.getByText("AAPL · NVDA")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Asset attribution for this backtest" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getAllByText("Selected")).toHaveLength(2);
    expect(within(table).getByText("MSFT")).toBeInTheDocument();
    expect(within(table).getByText("Stock return")).toBeInTheDocument();
    expect(within(table).getByText("Contribution")).toBeInTheDocument();
  });

  it("lets a number stay empty while it is being replaced", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);
    const shortWindow = screen.getByLabelText("Short window");

    fireEvent.change(shortWindow, { target: { value: "" } });
    expect(shortWindow).toHaveValue(null);
    fireEvent.change(shortWindow, { target: { value: "24" } });
    expect(shortWindow).toHaveValue(24);
  });

  it("keeps the previous date while a date field is temporarily empty", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);
    const start = screen.getByLabelText("Start", { exact: true });

    fireEvent.change(start, { target: { value: "" } });

    expect(start).toHaveValue("");
    expect(screen.getByText(/AAPL with moving average, Jan 3, 2023 to Jan 3, 2024/)).toBeInTheDocument();
    fireEvent.keyDown(start, { key: "Escape" });
    expect(start).toHaveValue("2023-01-03");
  });

  it("restores saved research controls after remounting", async () => {
    const first = render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);
    fireEvent.change(screen.getByLabelText("Market"), { target: { value: "India (NSE)" } });
    fireEvent.change(screen.getByLabelText("Tickers"), { target: { value: "RELIANCE, INFY" } });
    await waitFor(() => expect(window.localStorage.getItem("samquant.research.request.v1")).toContain("RELIANCE"));
    first.unmount();

    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    await waitFor(() => expect(screen.getByLabelText("Market")).toHaveValue("India (NSE)"));
    expect(screen.getByLabelText("Tickers")).toHaveValue("RELIANCE, INFY");
  });

  it("shows ranked settings in the parameter study tab", () => {
    const report: BacktestResponse = {
      ...(demoReport as BacktestResponse),
      strategyStudy: {
        selectionPercent: 70,
        validationPercent: 30,
        sharedLookback: 20,
        historicalWinner: {
          rank: 1,
          strategy: "Mean reversion",
          parameters: { lookback_window: 20, entry_z_score: -1.5, exit_z_score: 0 },
          selectionReturn: 0.12,
          validationReturn: 0.03,
          fullPeriodReturn: 0.15,
          maximumDrawdown: -0.08,
          tradeCount: 14,
        },
        bestByStrategy: [{
          rank: 1,
          strategy: "Mean reversion",
          parameters: { lookback_window: 20, entry_z_score: -1.5, exit_z_score: 0 },
          selectionReturn: 0.12,
          validationReturn: 0.03,
          fullPeriodReturn: 0.15,
          maximumDrawdown: -0.08,
          tradeCount: 14,
        }],
        trials: [{
          rank: 1,
          strategy: "Mean reversion",
          parameters: { lookback_window: 20, entry_z_score: -1.5, exit_z_score: 0 },
          selectionReturn: 0.12,
          validationReturn: 0.03,
          fullPeriodReturn: 0.15,
          maximumDrawdown: -0.08,
          tradeCount: 14,
        }],
      },
    };
    render(<ResearchTerminal initialReport={report} />);

    fireEvent.click(screen.getByRole("tab", { name: /Parameter study/ }));

    expect(screen.getByRole("table", { name: "Historical strategy parameter study" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mean reversion" })).toBeInTheDocument();
    expect(screen.getByText("Best settings found for each strategy")).toBeInTheDocument();
    expect(screen.getAllByText(/Entry z-score -1.5/)).toHaveLength(2);
    expect(screen.getByText(/entry z score -1.5/)).toBeInTheDocument();
  });

  it("does not carry a draft number into another strategy", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.change(screen.getByLabelText("Short window"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "mean_reversion" } });

    expect(screen.getByLabelText("Lookback window")).toHaveValue(20);
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

  it("keeps the setup collapsed until the researcher edits it", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);
    const toggle = screen.getByRole("button", { name: "Edit setup" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Close setup");
  });

  it("opens the executed trade table", () => {
    render(<ResearchTerminal initialReport={demoReport as BacktestResponse} />);

    fireEvent.click(screen.getByRole("tab", { name: /Trades/ }));

    expect(screen.getByRole("table", { name: "Executed trades for this backtest" })).toBeInTheDocument();
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
  });
});
