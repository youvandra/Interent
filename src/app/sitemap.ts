import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://interent.vercel.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    "/",
    "/input",
    "/provider",
    "/skill.md",
  ];

  return routes.map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.7,
  }));
}
