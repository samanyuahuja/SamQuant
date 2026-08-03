import type { MetadataRoute } from "next";

import { CONTENT_SLUGS } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "research", ...CONTENT_SLUGS].map((path) => ({
    url: `${base}/${path}`,
    changeFrequency: path === "changelog" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "research" ? 0.9 : 0.6,
  }));
}
