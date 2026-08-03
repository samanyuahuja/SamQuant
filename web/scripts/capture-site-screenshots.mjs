import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const outputDirectory = path.join(repositoryRoot, "docs", "images", "web");
const baseUrl = process.env.SAMQUANT_WEB_URL ?? "http://127.0.0.1:3000";
const viewports = [
  { label: "375", width: 375, height: 812 },
  { label: "768", width: 768, height: 1024 },
  { label: "1024", width: 1024, height: 900 },
  { label: "1440", width: 1440, height: 1000 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of [
      { path: "/", name: "home" },
      { path: "/research", name: "research" },
      { path: "/architecture", name: "architecture" },
    ]) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
      await page.locator("main#main-content").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({
        path: path.join(outputDirectory, `${route.name}-${viewport.label}.png`),
        fullPage: true,
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await Promise.all([
  copyFile(path.join(outputDirectory, "home-1440.png"), path.join(repositoryRoot, "docs", "images", "samquant-home-web.png")),
  copyFile(path.join(outputDirectory, "research-1440.png"), path.join(repositoryRoot, "docs", "images", "research-terminal-web.png")),
]);
