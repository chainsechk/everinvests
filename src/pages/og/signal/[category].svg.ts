// src/pages/og/signal/[category].svg.ts
// Dynamic OG image for category signal pages
import type { APIRoute } from "astro";
import { generateOGImage, getBiasColor } from "../../../lib/og";

const categoryLabels: Record<string, string> = {
  crypto: "Crypto Signals",
  forex: "Forex Signals",
  stocks: "Stock Signals",
};

export const GET: APIRoute = async ({ params, locals }) => {
  const { category } = params;
  const categoryLabel = categoryLabels[category || ""] || "Market Signals";

  // Try to get the current bias from DB
  let bias: string | null = null;
  let subtitle = "Updated multiple times daily";

  try {
    const db = locals.runtime?.env?.DB;
    if (db && category) {
      const signal = await db
        .prepare(
          `SELECT bias FROM signals
           WHERE category = ?
           ORDER BY date DESC, time_slot DESC
           LIMIT 1`
        )
        .bind(category)
        .first<{ bias: string }>();

      if (signal?.bias) {
        bias = signal.bias;
        subtitle = `Current bias: ${bias}`;
      }
    }
  } catch {
    // DB not available, use default
  }

  try {
    const svg = await generateOGImage({
      title: categoryLabel,
      subtitle,
      badge: bias || undefined,
      badgeColor: getBiasColor(bias),
      accentColor: "#00d9ff",
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("OG image generation failed:", error);
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#0a0a0f"/>
      <text x="600" y="300" text-anchor="middle" font-family="system-ui" font-size="64" font-weight="bold" fill="#ffffff">${categoryLabel}</text>
    </svg>`;
    return new Response(fallback, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
};
