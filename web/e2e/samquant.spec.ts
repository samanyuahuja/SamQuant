import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page tells the complete system story", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Test the strategy/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The decision layer." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /The strategy decides/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Return without risk/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open research terminal/ }).first()).toBeVisible();
});

test("research terminal runs the primary backtest journey", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByLabel("Tickers").fill("AAPL, MSFT");
  await page.getByLabel("Short window").fill("10");
  await page.getByLabel("Long window").fill("40");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/backtests") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect((await responsePromise).status()).toBe(200);
  await expect(page.getByText("AAPL + MSFT")).toBeVisible();
  await expect(page.getByRole("button", { name: "Trades CSV" })).toBeEnabled();
});

test("invalid inputs stay understandable", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByLabel("Start", { exact: true }).fill("2024-02-01");
  await page.getByLabel("End", { exact: true }).fill("2024-01-01");
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect(page.locator("[role='alert']").filter({ hasText: "Backtest not run" })).toContainText("End date must be later than start date");
});

test("pages fit the active viewport", async ({ page }) => {
  for (const path of ["/", "/research", "/methodology"]) {
    await page.goto(path);
    if (path === "/research") {
      await expect(page.getByRole("figure", { name: /daily candlesticks/ })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("reduced motion keeps the story readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Test the strategy/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Now run the system/ })).toBeVisible();
});

test("local web vitals stay within product budgets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One desktop run records local performance budgets.");
  await page.addInitScript(() => {
    const target = window as Window & { __samquantVitals?: { lcp: number; cls: number } };
    target.__samquantVitals = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      target.__samquantVitals!.lcp = entries.at(-1)?.startTime ?? 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) target.__samquantVitals!.cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForTimeout(500);
  const vitals = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __samquantVitals: { lcp: number; cls: number };
        }
      ).__samquantVitals,
  );
  expect(vitals.lcp).toBeLessThan(2_500);
  expect(vitals.cls).toBeLessThan(0.1);

  const interaction = await page.evaluate(async () => {
    const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes("Mean reversion"));
    if (!button) return Number.POSITIVE_INFINITY;
    const start = performance.now();
    button.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return performance.now() - start;
  });
  expect(interaction).toBeLessThan(200);
});

test("critical pages have no serious automated accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser is enough for automated axe coverage.");
  for (const path of ["/", "/research", "/methodology"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});

test("desktop visual baselines remain stable", async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI) || testInfo.project.name !== "desktop", "Local desktop baselines cover the main visual system.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page).toHaveScreenshot("landing-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixels: 5_000 });
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await expect(page.getByRole("figure", { name: /daily candlesticks/ })).toBeVisible();
  await expect(page).toHaveScreenshot("research-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixels: 5_000 });
});
