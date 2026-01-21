// src/pages/rss.xml.ts
import type { APIContext } from "astro";
import { SITE_URL } from "../lib/site";

interface SignalRow {
  id: number;
  category: string;
  date: string;
  time_slot: string;
  bias: string;
  summary: string;
  created_at: string;
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

  let signals: SignalRow[] = [];

  if (db) {
    try {
      const result = await db.prepare(`
        SELECT id, category, date, time_slot, bias, summary, created_at
        FROM signals
        ORDER BY date DESC, time_slot DESC
        LIMIT 50
      `).all<SignalRow>();
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
    const description = escapeXml(signal.summary || `${categoryTitle} signal is ${signal.bias} for ${signal.date} ${signal.time_slot} UTC`);

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <category>${categoryTitle}</category>
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>EverInvests - Market Signals</title>
    <link>${SITE_URL}</link>
    <description>Free daily market signals for crypto, forex, and stocks. Automated bias analysis with macro context.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
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
