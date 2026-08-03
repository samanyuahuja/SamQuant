import type { ApiError, BacktestRequest, BacktestResponse } from "@/lib/types";

export class ResearchApiError extends Error {
  constructor(
    message: string,
    public readonly fields: string[] = [],
  ) {
    super(message);
    this.name = "ResearchApiError";
  }
}

export async function runBacktest(
  request: BacktestRequest,
  signal?: AbortSignal,
): Promise<BacktestResponse> {
  const response = await fetch("/api/backtests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const payload = (await response.json()) as BacktestResponse | ApiError;
  if (!response.ok) {
    const error = payload as ApiError;
    throw new ResearchApiError(
      error.error?.message ?? "The backtest could not be completed.",
      error.error?.fields ?? [],
    );
  }
  return payload as BacktestResponse;
}
