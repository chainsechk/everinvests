// src/pages/og/signal/[category]/[date]/[time].svg.ts
// Dynamic OG image for individual signal pages
import type { APIRoute } from "astro";
import { generateOGImage, getBiasColor } from "../../../../../lib/og";

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
          `SELECT overall_bias, output_json FROM signals
           WHERE category = ? AND date = ? AND time_slot = ?
           LIMIT 1`
        )
        .bind(category, date, time)
        .first<{ overall_bias: string; output_json: string | null }>();

      if (signal) {
        bias = signal.overall_bias;

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
    const svg = await generateOGImage({
      title,
      subtitle,
      badge: bias || undefined,
      badgeColor: getBiasColor(bias),
      accentColor: category === "crypto" ? "#f7931a" : category === "forex" ? "#00d9ff" : "#22c55e",
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        // Shorter cache for signal-specific images since they update
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    });
  } catch (error) {
    console.error("OG image generation failed:", error);
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#0a0a0f"/>
      <text x="600" y="280" text-anchor="middle" font-family="system-ui" font-size="48" font-weight="bold" fill="#ffffff">${categoryLabel} Signal</text>
      <text x="600" y="350" text-anchor="middle" font-family="system-ui" font-size="32" fill="${getBiasColor(bias)}">${bias || "Loading..."}</text>
    </svg>`;
    return new Response(fallback, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
};
