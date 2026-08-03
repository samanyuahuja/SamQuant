import type { BacktestRequest, BacktestResponse, Market } from "./types";

const REQUEST_KEY = "samquant.research.request.v1";
const REPORT_KEY = "samquant.research.report.v1";

export function loadResearchRequest(): BacktestRequest | null {
  return readJson(REQUEST_KEY, isBacktestRequest);
}

export function loadResearchReport(): BacktestResponse | null {
  return readJson(REPORT_KEY, isBacktestResponse);
}

export function saveResearchRequest(request: BacktestRequest): void {
  writeJson(REQUEST_KEY, request);
}

export function saveResearchReport(report: BacktestResponse): void {
  writeJson(REPORT_KEY, report);
}

export function clearResearchSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REQUEST_KEY);
    window.localStorage.removeItem(REPORT_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function latestCompletedMarketDate(market: Market, now = new Date()): string {
  const schedule = market === "US"
    ? { timeZone: "America/New_York", closeMinutes: 16 * 60 }
    : { timeZone: "Asia/Kolkata", closeMinutes: 15 * 60 + 30 };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  let candidate = `${value("year")}-${String(value("month")).padStart(2, "0")}-${String(value("day")).padStart(2, "0")}`;
  const minutes = value("hour") * 60 + value("minute");
  if (isWeekend(candidate) || minutes < schedule.closeMinutes) candidate = shiftDate(candidate, -1);
  while (isWeekend(candidate)) candidate = shiftDate(candidate, -1);
  return candidate;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function readJson<T>(key: string, validate: (value: unknown) => value is T): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Do not leave an older result paired with newly saved controls.
    window.localStorage.removeItem(key);
  }
}

function isBacktestRequest(value: unknown): value is BacktestRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<BacktestRequest>;
  return Array.isArray(request.symbols)
    && request.symbols.every((symbol) => typeof symbol === "string")
    && typeof request.start === "string"
    && typeof request.end === "string"
    && typeof request.market === "string"
    && typeof request.strategy === "string"
    && !!request.parameters;
}

function isBacktestResponse(value: unknown): value is BacktestResponse {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<BacktestResponse>;
  return !!report.metadata && !!report.market && !!report.portfolio && !!report.metrics;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isWeekend(value: string): boolean {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
