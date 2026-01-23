// src/pages/rss.xml.ts
import type { APIContext } from "astro";
import { SITE_URL } from "../lib/site";

interface SignalRow {
  id: number;
  category: string;
  date: string;
  time_slot: string;
  bias: string;
  output_json: string | null;
  generated_at: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRfc822Date(dateStr: string, timeSlot: string): string {
  // Parse date and time slot to create RFC 822 date
  const [year, month, day] = dateStr.split("-").map(Number);
  const hour = parseInt(timeSlot.replace(":00", ""), 10);
  const date = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  return date.toUTCString();
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case "crypto": return "₿";
    case "forex": return "$";
    case "stocks": return "◊";
    default: return "•";
  }
}

function getBiasEmoji(bias: string): string {
  switch (bias) {
    case "Bullish": return "🟢";
    case "Bearish": return "🔴";
    default: return "🟡";
  }
}

export async function GET(context: APIContext) {
  const db = context.locals.runtime?.env?.DB;
  const now = new Date().toUTCString();

  // Support category-specific feeds via ?category=crypto
  const url = new URL(context.request.url);
  const categoryParam = url.searchParams.get("category")?.toLowerCase();
  const validCategories = ["crypto", "forex", "stocks"];
  const category = categoryParam && validCategories.includes(categoryParam) ? categoryParam : null;

  let signals: SignalRow[] = [];

  if (db) {
    try {
      const query = category
        ? `SELECT id, category, date, time_slot, bias, output_json, generated_at
           FROM signals WHERE category = ?
           ORDER BY date DESC, time_slot DESC LIMIT 50`
        : `SELECT id, category, date, time_slot, bias, output_json, generated_at
           FROM signals
           ORDER BY date DESC, time_slot DESC LIMIT 50`;

      const result = category
        ? await db.prepare(query).bind(category).all<SignalRow>()
        : await db.prepare(query).all<SignalRow>();

      signals = result.results || [];
    } catch (e) {
      console.error("RSS feed error:", e);
    }
  }

  const items = signals.map((signal) => {
    const categoryTitle = signal.category.charAt(0).toUpperCase() + signal.category.slice(1);
    const emoji = getCategoryEmoji(signal.category);
    const biasEmoji = getBiasEmoji(signal.bias);
    const title = `${emoji} ${categoryTitle}: ${biasEmoji} ${signal.bias}`;
    const link = `${SITE_URL}/${signal.category}/${signal.date}/${signal.time_slot}`;
    const pubDate = formatRfc822Date(signal.date, signal.time_slot);
    // Extract summary from output_json (summary column doesn't exist in schema)
    const output = signal.output_json ? JSON.parse(signal.output_json) : null;
    const summary = output?.summary || `${categoryTitle} signal is ${signal.bias} for ${signal.date} ${signal.time_slot} UTC`;
    const description = escapeXml(summary);

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <category>${categoryTitle}</category>
    </item>`;
  });

  // Category-aware metadata
  const categoryTitle = category ? category.charAt(0).toUpperCase() + category.slice(1) : null;
  const feedTitle = categoryTitle
    ? `EverInvests - ${categoryTitle} Signals`
    : "EverInvests - Market Signals";
  const feedDescription = categoryTitle
    ? `Free daily ${category} signals with bias analysis and macro context.`
    : "Free daily market signals for crypto, forex, and stocks. Automated bias analysis with macro context.";
  const feedLink = category ? `${SITE_URL}/${category}` : SITE_URL;
  const selfLink = category ? `${SITE_URL}/rss.xml?category=${category}` : `${SITE_URL}/rss.xml`;

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${feedTitle}</title>
    <link>${feedLink}</link>
    <description>${feedDescription}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${selfLink}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/favicon.svg</url>
      <title>EverInvests</title>
      <link>${SITE_URL}</link>
    </image>
    <ttl>60</ttl>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
