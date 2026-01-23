// src/pages/og/default.svg.ts
// Static default OG image (SVG)
import type { APIRoute } from "astro";
import { generateOGImage } from "../../lib/og";

export const GET: APIRoute = async () => {
  try {
    const svg = await generateOGImage({
      title: "EverInvests",
      subtitle: "Daily Market Signals for Crypto, Forex, Stocks",
      accentColor: "#00d9ff",
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("OG image generation failed:", error);
    // Return a simple fallback SVG
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#0a0a0f"/>
      <text x="600" y="300" text-anchor="middle" font-family="system-ui" font-size="64" font-weight="bold" fill="#ffffff">EverInvests</text>
      <text x="600" y="360" text-anchor="middle" font-family="system-ui" font-size="24" fill="#9ca3af">Daily Market Signals</text>
    </svg>`;
    return new Response(fallback, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
};
