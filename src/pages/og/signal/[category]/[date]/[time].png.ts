// src/pages/og/signal/[category]/[date]/[time].png.ts
// Dynamic OG image for individual signal pages (PNG for Twitter/Facebook)
import type { APIRoute } from "astro";
import { generateOGImagePNG, getBiasColor } from "../../../../../lib/og";

const categoryLabels: Record<string, string> = {
  crypto: "Crypto",
  forex: "Forex",
  stocks: "Stocks",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { category, date, time } = params;
  const categoryLabel = categoryLabels[category || ""] || "Market";

  // Default values
  let bias: string | null = null;
  let subtitle = `Signal for ${formatDate(date || "")} at ${time || "00:00"} UTC`;
  let summary = "";

  // Try to get signal data from DB
  try {
    const db = locals.runtime?.env?.DB;
    if (db && category && date && time) {
      const signal = await db
        .prepare(
          `SELECT bias, output_json FROM signals
           WHERE category = ? AND date = ? AND time_slot = ?
           LIMIT 1`
        )
        .bind(category, date, time)
        .first<{ bias: string; output_json: string | null }>();

      if (signal) {
        bias = signal.bias;

        // Try to extract summary from output_json
        if (signal.output_json) {
          try {
            const output = JSON.parse(signal.output_json);
            if (output.summary) {
              // Truncate summary for OG image
              summary = output.summary.length > 80
                ? output.summary.substring(0, 77) + "..."
                : output.summary;
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Build subtitle with bias
        subtitle = summary || `${categoryLabel} is ${bias} on ${formatDate(date)}`;
      }
    }
  } catch {
    // DB not available, use defaults
  }

  const title = `${categoryLabel} Signal: ${bias || "Loading..."}`;

  try {
    const png = await generateOGImagePNG({
      title,
      subtitle,
      badge: bias || undefined,
      badgeColor: getBiasColor(bias),
      accentColor: category === "crypto" ? "#f7931a" : category === "forex" ? "#00d9ff" : "#22c55e",
    });

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        // Shorter cache for signal-specific images since they update
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    });
  } catch (error) {
    console.error("OG PNG generation failed:", error);
    // Redirect to SVG fallback
    return Response.redirect(`/og/signal/${category}/${date}/${time}.svg`, 302);
  }
};
