import { NextResponse } from "next/server";

const API_URL = process.env.SAMQUANT_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const body = await request.text();
    const response = await fetch(`${API_URL}/api/v1/backtests`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "x-request-id": response.headers.get("x-request-id") ?? requestId },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "API_UNAVAILABLE",
          message: "The research engine is unavailable. Check the Python API and try again.",
          fields: [],
          requestId,
        },
      },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
