// src/pages/sitemap.xml.ts
import type { APIContext } from "astro";

const siteUrl = "https://everinvests.pages.dev";

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "hourly" },
  { url: "/crypto", priority: "0.9", changefreq: "hourly" },
  { url: "/forex", priority: "0.9", changefreq: "hourly" },
  { url: "/stocks", priority: "0.9", changefreq: "hourly" },
  { url: "/crypto/history", priority: "0.7", changefreq: "daily" },
  { url: "/forex/history", priority: "0.7", changefreq: "daily" },
  { url: "/stocks/history", priority: "0.7", changefreq: "daily" },
  { url: "/about", priority: "0.5", changefreq: "monthly" },
];

export async function GET(context: APIContext) {
  const today = new Date().toISOString().split("T")[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${siteUrl}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
