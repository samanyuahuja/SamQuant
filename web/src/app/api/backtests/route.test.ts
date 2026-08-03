import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("backtest API proxy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards valid requests and preserves the request identifier", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "engine-run" },
    }));

    const response = await POST(new Request("http://localhost/api/backtests", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "web-run" },
      body: JSON.stringify({ strategy: "moving_average" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("engine-run");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/backtests",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("returns a safe recovery message when Python is unavailable", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1"));

    const response = await POST(new Request("http://localhost/api/backtests", { method: "POST", body: "{}" }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.message).toBe("The research engine is unavailable. Check the Python API and try again.");
    expect(JSON.stringify(payload)).not.toContain("ECONNREFUSED");
  });
});
