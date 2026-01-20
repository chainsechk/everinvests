import type { APIRoute } from "astro";
import { getLatestSignal } from "../../../lib/db";

// OG Image dimensions
const WIDTH = 1200;
const HEIGHT = 630;

// Colors
const COLORS = {
  bg: "#0a0e17",
  bgGradient: "#141a24",
  bullish: "#00ff88",
  bearish: "#ff4466",
  neutral: "#5e6e82",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  accent: "#00d4ff",
};

const CATEGORY_CONFIG: Record<string, { icon: string; label: string }> = {
  crypto: { icon: "₿", label: "Crypto" },
  forex: { icon: "$", label: "Forex" },
  stocks: { icon: "◊", label: "Stocks" },
};

function getBiasColor(bias: string | null): string {
  if (!bias) return COLORS.neutral;
  const lower = bias.toLowerCase();
  if (lower === "bullish") return COLORS.bullish;
  if (lower === "bearish") return COLORS.bearish;
  return COLORS.neutral;
}

function generateOGSvg(
  category: string,
  bias: string | null,
  date: string | null,
  timeSlot: string | null
): string {
  const config = CATEGORY_CONFIG[category] || { icon: "?", label: category };
  const biasColor = getBiasColor(bias);
  const biasText = bias || "No Signal";
  const dateText = date && timeSlot ? `${date} ${timeSlot} UTC` : "Loading...";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${COLORS.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${COLORS.bgGradient};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="biasGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${biasColor};stop-opacity:0.3" />
      <stop offset="50%" style="stop-color:${biasColor};stop-opacity:0.1" />
      <stop offset="100%" style="stop-color:${biasColor};stop-opacity:0.3" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGradient)"/>

  <!-- Grid pattern -->
  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="${COLORS.accent}" stroke-width="0.5" opacity="0.05"/>
  </pattern>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>

  <!-- Glow effect behind bias -->
  <ellipse cx="600" cy="315" rx="300" ry="100" fill="url(#biasGlow)"/>

  <!-- Category icon and label -->
  <text x="100" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="48" fill="${COLORS.textMuted}">${config.icon}</text>
  <text x="160" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="600" fill="${COLORS.text}">${config.label} Signals</text>

  <!-- Main bias display -->
  <text x="600" y="280" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="120" font-weight="bold" fill="${biasColor}">${biasText}</text>

  <!-- Date/time -->
  <text x="600" y="360" text-anchor="middle" font-family="monospace" font-size="28" fill="${COLORS.textMuted}">${dateText}</text>

  <!-- Branding -->
  <text x="600" y="540" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="bold" fill="${COLORS.text}">EverInvests</text>
  <text x="600" y="580" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="${COLORS.textMuted}">Free Daily Market Signals</text>

  <!-- Accent line -->
  <rect x="400" y="440" width="400" height="3" rx="1.5" fill="${biasColor}" opacity="0.6"/>
</svg>`;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const category = params.category?.toLowerCase();

  if (!category || !["crypto", "forex", "stocks"].includes(category)) {
    return new Response("Invalid category", { status: 400 });
  }

  const db = locals.runtime?.env?.DB;

  let bias: string | null = null;
  let date: string | null = null;
  let timeSlot: string | null = null;

  if (db) {
    try {
      const signal = await getLatestSignal(db, category as "crypto" | "forex" | "stocks");
      if (signal) {
        bias = signal.bias;
        date = signal.date;
        timeSlot = signal.time_slot;
      }
    } catch (e) {
      console.error("Error fetching signal for OG:", e);
    }
  }

  const svg = generateOGSvg(category, bias, date, timeSlot);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300", // 5 min cache
    },
  });
};
