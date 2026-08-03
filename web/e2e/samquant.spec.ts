import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page tells the complete system story", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Test the strategy/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Indicators analyze. Strategies decide." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /The strategy decides/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Return without risk/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open research terminal/ }).first()).toBeVisible();
  await expect(page.locator("[data-scroll-zoom]")).toHaveCount(5);
});

test("visualizations rise and zoom into place while scrolling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One desktop run verifies the full scroll motion.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const strategyChart = page.locator("[data-scroll-zoom='strategy']");
  await page.waitForTimeout(100);
  const before = await strategyChart.evaluate((element) => ({
    transform: getComputedStyle(element).transform,
  }));

  expect(before.transform).not.toBe("none");

  await strategyChart.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const after = await strategyChart.evaluate((element) => ({
    transform: getComputedStyle(element).transform,
  }));

  expect(after.transform).not.toBe(before.transform);
});

test("research terminal runs the primary backtest journey", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What this run actually says" })).toBeVisible();
  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByLabel("Tickers").fill("AAPL, MSFT");
  const shortWindow = page.getByLabel("Short window");
  await shortWindow.fill("");
  await expect(shortWindow).toHaveValue("");
  await shortWindow.fill("10");
  await expect(shortWindow).toHaveValue("10");
  await page.getByLabel("Long window").fill("40");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/backtests") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect((await responsePromise).status()).toBe(200);
  await expect(page.getByText("Backtest research / AAPL + MSFT", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Parameter study/ }).click();
  await expect(page.getByRole("table", { name: "Historical strategy parameter study" })).toBeVisible();
  await page.getByTitle("Export results").click();
  await expect(page.getByRole("button", { name: "Trades CSV" })).toBeVisible();
});

test("research settings and results survive a refresh", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByLabel("Market").selectOption("India (NSE)");
  await page.getByLabel("Tickers").fill("RELIANCE, INFY");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/backtests"));
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect((await responsePromise).status()).toBe(200);
  await expect(page.getByText("Backtest research / RELIANCE.NS + INFY.NS", { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByText("Backtest research / RELIANCE.NS + INFY.NS", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Market")).toHaveValue("India (NSE)");
  await expect(page.getByLabel("Tickers")).toHaveValue("RELIANCE, INFY");
});

test("date drafts do not reset the research header", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByRole("button", { name: "Edit setup" }).click();
  const end = page.getByLabel("End", { exact: true });
  await end.fill("");
  await expect(page.getByRole("heading", { name: "Moving average crossover" })).toBeVisible();
  await end.press("Escape");
  await expect(end).toHaveValue("2024-01-03");
  const maximum = await end.getAttribute("max");
  expect(maximum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("invalid inputs stay understandable", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByLabel("Start", { exact: true }).fill("2024-02-01");
  await page.getByLabel("End", { exact: true }).fill("2024-01-01");
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect(page.locator("[role='alert']").filter({ hasText: "Backtest not run" })).toContainText("End date must be later than start date");
});

test("empty tickers are rejected before a request is sent", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByLabel("Tickers").fill("");
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Backtest not run" })).toContainText("Enter at least one ticker symbol");
  await expect(page.getByLabel("Tickers")).toBeFocused();
});

test("loading state names the work in progress", async ({ page }) => {
  await page.route("**/api/backtests", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByRole("button", { name: "Run backtest" }).click();
  await expect(page.getByRole("button", { name: "Running backtest" })).toBeDisabled();
  await expect(page.getByText("Running the Python research engine")).toBeVisible();
});

test("backend failures stay useful and do not expose internals", async ({ page }) => {
  await page.route("**/api/backtests", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "API_UNAVAILABLE", message: "The research engine is unavailable. Check the Python API and try again.", fields: [], requestId: "browser-test" } }),
  }));
  await page.goto("/research");
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await page.getByRole("button", { name: "Run backtest" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Backtest not run" });
  await expect(alert).toContainText("research engine is unavailable");
  await expect(alert).not.toContainText("ECONNREFUSED");
});

test("pages fit the active viewport", async ({ page }) => {
  for (const path of ["/", "/research", "/methodology", "/docs", "/architecture", "/about", "/privacy", "/terms", "/disclaimer", "/data-and-attribution", "/accessibility", "/changelog"]) {
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
  await expect(page.getByRole("heading", { name: "Run the complete system." })).toBeVisible();
  const firstVisualization = page.locator("[data-scroll-zoom]").first();
  await expect(firstVisualization).toHaveCSS("opacity", "1");
  await expect(firstVisualization).toHaveCSS("transform", "none");
});

test("brand metadata and professional routes are complete", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SamQuant/);
  await expect(page.locator("link[rel='manifest']")).toHaveAttribute("href", /manifest/);
  for (const path of ["/methodology", "/docs", "/architecture", "/about", "/privacy", "/terms", "/disclaimer", "/data-and-attribution", "/accessibility", "/changelog"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main#main-content")).toBeVisible();
  }
  const missing = await page.goto("/not-a-real-samquant-route");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "No data exists at this route." })).toBeVisible();
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
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page).toHaveScreenshot("landing-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixels: 5_000 });
  await page.goto("/research");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator("main[data-ready='true']")).toBeVisible();
  await expect(page.getByRole("figure", { name: /daily candlesticks/ })).toBeVisible();
  await page.waitForFunction(() => [...document.querySelectorAll("canvas")].every((canvas) => canvas.width > 0 && canvas.height > 0));
  const chartHasData = await page.locator("canvas").evaluateAll((elements) => elements.some((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return false;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 64) {
      colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}:${pixels[index + 3]}`);
      if (colors.size > 4) return true;
    }
    return false;
  }));
  expect(chartHasData).toBe(true);
  await expect(page).toHaveScreenshot("research-desktop.png", {
    fullPage: true,
    animations: "disabled",
    mask: [page.locator("canvas")],
    maskColor: "#fffdf8",
    maxDiffPixels: 5_000,
  });
});
