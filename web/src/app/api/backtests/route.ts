import { NextResponse } from "next/server";

const API_URL = process.env.SAMQUANT_API_URL ?? "http://127.0.0.1:8000";
const INTERNAL_API_KEY = process.env.SAMQUANT_INTERNAL_API_KEY;
const MAX_BODY_BYTES = 32_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const requestWindows = new Map<string, number[]>();

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";
}

function rateLimited(address: string) {
  const now = Date.now();
  const recent = (requestWindows.get(address) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return true;
  requestWindows.set(address, [...recent, now]);
  return false;
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  if (rateLimited(clientAddress(request))) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many research requests. Try again in a minute.", fields: [], requestId } }, { status: 429, headers: { "retry-after": "60", "x-request-id": requestId } });
  }
  if (process.env.NODE_ENV === "production" && !INTERNAL_API_KEY) {
    return NextResponse.json({ error: { code: "MISCONFIGURED", message: "The research engine is temporarily unavailable.", fields: [], requestId } }, { status: 503 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: { code: "REQUEST_TOO_LARGE", message: "The research request is too large.", fields: [], requestId } }, { status: 413 });
    }
    const response = await fetch(`${API_URL}/api/v1/backtests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
        ...(INTERNAL_API_KEY ? { "x-samquant-internal-key": INTERNAL_API_KEY } : {}),
      },
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
