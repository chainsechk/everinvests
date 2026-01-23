// src/pages/og/default.png.ts
// Static default OG image (PNG for Twitter/Facebook compatibility)
import type { APIRoute } from "astro";
import { generateOGImagePNG } from "../../lib/og";

export const GET: APIRoute = async () => {
  try {
    const png = await generateOGImagePNG({
      title: "EverInvests",
      subtitle: "Daily Market Signals for Crypto, Forex, Stocks",
      accentColor: "#00d9ff",
    });

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("OG PNG generation failed:", error);
    // Redirect to SVG fallback
    return Response.redirect("/og/default.svg", 302);
  }
};
