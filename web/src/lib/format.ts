export function formatPercent(value: number | null, digits = 1): string {
  return value === null
    ? "N/A"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
}

export function formatMoney(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null, digits = 2): string {
  return value === null
    ? "N/A"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
