// src/pages/og/signal/[category].png.ts
// Dynamic OG image for category signal pages (PNG for Twitter/Facebook)
import type { APIRoute } from "astro";
import { generateOGImagePNG, getBiasColor } from "../../../lib/og";

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
    const png = await generateOGImagePNG({
      title: categoryLabel,
      subtitle,
      badge: bias || undefined,
      badgeColor: getBiasColor(bias),
      accentColor: "#00d9ff",
    });

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("OG PNG generation failed:", error);
    // Redirect to SVG fallback
    return Response.redirect(`/og/signal/${category}.svg`, 302);
  }
};
