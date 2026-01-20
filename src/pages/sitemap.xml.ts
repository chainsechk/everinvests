// src/pages/sitemap.xml.ts
import type { APIContext } from "astro";
import { SITE_URL } from "../lib/site";
import type { Category } from "../lib/db";

interface BlogPost {
  slug: string;
  published_at: string;
}

interface SignalPage {
  category: Category;
  date: string;
  time_slot: string;
}

interface AssetTicker {
  ticker: string;
}

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "hourly" },
  { url: "/crypto", priority: "0.9", changefreq: "hourly" },
  { url: "/forex", priority: "0.9", changefreq: "hourly" },
  { url: "/stocks", priority: "0.9", changefreq: "hourly" },
  { url: "/performance", priority: "0.8", changefreq: "daily" },
  { url: "/crypto/history", priority: "0.7", changefreq: "daily" },
  { url: "/forex/history", priority: "0.7", changefreq: "daily" },
  { url: "/stocks/history", priority: "0.7", changefreq: "daily" },
  { url: "/blog", priority: "0.8", changefreq: "daily" },
  { url: "/about", priority: "0.5", changefreq: "monthly" },
];

export async function GET(context: APIContext) {
  const today = new Date().toISOString().split("T")[0];
  const db = context.locals.runtime.env.DB;

  // Fetch all blog posts for dynamic URLs
  let blogPosts: BlogPost[] = [];
  try {
    const result = await db.prepare(
      "SELECT slug, published_at FROM blog_posts ORDER BY published_at DESC LIMIT 100"
    ).all<BlogPost>();
    blogPosts = result.results || [];
  } catch {
    // Blog table may not exist yet
  }

  // Fetch recent signal pages (last 90 days worth)
  let signalPages: SignalPage[] = [];
  try {
    const result = await db.prepare(
      `SELECT category, date, time_slot
       FROM signals
       ORDER BY date DESC, time_slot DESC
       LIMIT 500`
    ).all<SignalPage>();
    signalPages = result.results || [];
  } catch {
    // Signals table may not exist
  }

  // Fetch distinct tickers for each category
  let cryptoTickers: string[] = [];
  let forexPairs: string[] = [];
  let stockTickers: string[] = [];

  try {
    const [cryptoResult, forexResult, stocksResult] = await Promise.all([
      db.prepare(
        `SELECT DISTINCT a.ticker FROM asset_signals a
         JOIN signals s ON a.signal_id = s.id
         WHERE s.category = 'crypto' ORDER BY a.ticker`
      ).all<AssetTicker>(),
      db.prepare(
        `SELECT DISTINCT a.ticker FROM asset_signals a
         JOIN signals s ON a.signal_id = s.id
         WHERE s.category = 'forex' ORDER BY a.ticker`
      ).all<AssetTicker>(),
      db.prepare(
        `SELECT DISTINCT a.ticker FROM asset_signals a
         JOIN signals s ON a.signal_id = s.id
         WHERE s.category = 'stocks' ORDER BY a.ticker`
      ).all<AssetTicker>(),
    ]);
    cryptoTickers = cryptoResult.results?.map(r => r.ticker) || [];
    forexPairs = forexResult.results?.map(r => r.ticker) || [];
    stockTickers = stocksResult.results?.map(r => r.ticker) || [];
  } catch {
    // Asset tables may not exist
  }

  const staticUrls = staticPages.map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  );

  const blogUrls = blogPosts.map(
    (post) => `  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${post.published_at.split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
  );

  // Signal detail pages
  const signalUrls = signalPages.map(
    (signal) => `  <url>
    <loc>${SITE_URL}/${signal.category}/${signal.date}/${signal.time_slot}</loc>
    <lastmod>${signal.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
  );

  // Asset pages
  const cryptoAssetUrls = cryptoTickers.map(
    (ticker) => `  <url>
    <loc>${SITE_URL}/crypto/${ticker.toLowerCase()}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`
  );

  const forexAssetUrls = forexPairs.map(
    (pair) => `  <url>
    <loc>${SITE_URL}/forex/${pair.toLowerCase()}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`
  );

  const stockAssetUrls = stockTickers.map(
    (ticker) => `  <url>
    <loc>${SITE_URL}/stocks/${ticker.toLowerCase()}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...blogUrls, ...signalUrls, ...cryptoAssetUrls, ...forexAssetUrls, ...stockAssetUrls].join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
