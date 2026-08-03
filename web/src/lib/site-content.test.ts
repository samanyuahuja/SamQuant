import { describe, expect, it } from "vitest";

import { CONTENT_PAGES } from "./site-content";

const REQUIRED_PAGES = [
  "methodology",
  "docs",
  "architecture",
  "about",
  "privacy",
  "terms",
  "disclaimer",
  "data-and-attribution",
  "accessibility",
  "changelog",
];

describe("site content", () => {
  it("contains every professional and trust page", () => {
    expect(Object.keys(CONTENT_PAGES).sort()).toEqual(REQUIRED_PAGES.sort());
  });

  it("keeps public copy direct and free from banned marketing language", () => {
    const text = JSON.stringify(CONTENT_PAGES).toLowerCase();
    expect(text).not.toContain("—");
    expect(text).not.toContain("unlock the power");
    expect(text).not.toContain("revolutionize");
    expect(text).not.toContain("next-generation platform");
    expect(text).not.toContain("supercharge your journey");
  });

  it("states the material research disclaimer", () => {
    const disclaimer = JSON.stringify(CONTENT_PAGES.disclaimer).toLowerCase();
    expect(disclaimer).toContain("not investment advice");
    expect(disclaimer).toContain("hypothetical");
    expect(disclaimer).toContain("past performance");
  });
});
