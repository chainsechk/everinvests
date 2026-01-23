// src/lib/og.ts
// OG Image generation utilities using satori + resvg for PNG output
// PNG format ensures compatibility with Twitter/X and Facebook
import satori from "satori";
// Use workerd-specific import for Cloudflare Pages/Workers
import { Resvg } from "@cf-wasm/resvg/workerd";

// Inter font (fetched at runtime)
const fontCache: { bold?: ArrayBuffer; regular?: ArrayBuffer } = {};

async function loadFonts() {
  if (!fontCache.bold) {
    fontCache.bold = await fetch(
      "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_0ew.woff"
    ).then((res) => res.arrayBuffer());
  }
  if (!fontCache.regular) {
    fontCache.regular = await fetch(
      "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_0ew.woff"
    ).then((res) => res.arrayBuffer());
  }
  return { bold: fontCache.bold, regular: fontCache.regular };
}

export interface OGImageOptions {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  accentColor?: string;
}

export async function generateOGImage(options: OGImageOptions): Promise<string> {
  const {
    title,
    subtitle = "Daily Market Signals for Crypto, Forex, Stocks",
    badge,
    badgeColor = "#22c55e",
    accentColor = "#00d9ff",
  } = options;

  const fonts = await loadFonts();

  // Build the element tree for satori
  const element = {
    type: "div",
    props: {
      style: {
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0f",
        padding: "60px",
      },
      children: [
        // Badge (optional)
        badge
          ? {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 24px",
                  borderRadius: "9999px",
                  backgroundColor: badgeColor,
                  color: "#ffffff",
                  fontSize: "24px",
                  fontWeight: 700,
                  marginBottom: "24px",
                },
                children: badge,
              },
            }
          : null,
        // Title
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: title.length > 30 ? "48px" : "64px",
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.2,
              maxWidth: "1000px",
            },
            children: title,
          },
        },
        // Subtitle
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: "24px",
              color: "#9ca3af",
              marginTop: "24px",
              textAlign: "center",
            },
            children: subtitle,
          },
        },
        // Accent line
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: "200px",
              height: "4px",
              backgroundColor: accentColor,
              borderRadius: "2px",
              marginTop: "40px",
            },
          },
        },
        // Logo/brand
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: "20px",
              color: "#6b7280",
              marginTop: "40px",
            },
            children: "everinvests.com",
          },
        },
      ].filter(Boolean),
    },
  };

  // Generate SVG using satori
  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "Inter",
        data: fonts.bold,
        weight: 700,
        style: "normal",
      },
      {
        name: "Inter",
        data: fonts.regular,
        weight: 400,
        style: "normal",
      },
    ],
  });

  return svg;
}

// Convert SVG to PNG for Twitter/Facebook compatibility
export async function generateOGImagePNG(options: OGImageOptions): Promise<Uint8Array> {
  const svg = await generateOGImage(options);

  // Use async static method for Cloudflare Workers compatibility
  const resvg = await Resvg.async(svg, {
    fitTo: {
      mode: "width",
      value: 1200,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}

// Bias-specific colors
export const biasColors: Record<string, string> = {
  bullish: "#22c55e",
  "strong bullish": "#22c55e",
  bearish: "#ef4444",
  "strong bearish": "#ef4444",
  neutral: "#6b7280",
};

export function getBiasColor(bias: string | null): string {
  if (!bias) return "#6b7280";
  const lower = bias.toLowerCase();
  return biasColors[lower] || "#6b7280";
}
