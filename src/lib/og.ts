// src/lib/og.ts
// OG Image generation utilities using satori + resvg for PNG output
// PNG format ensures compatibility with Twitter/X and Facebook
// Supports multi-script fonts: Latin, CJK, Cyrillic, Arabic, Devanagari
import satori from "satori";
// Use workerd-specific import for Cloudflare Pages/Workers
import { Resvg } from "@cf-wasm/resvg/workerd";

// Font cache for all scripts
const fontCache: Record<string, ArrayBuffer> = {};

// Google Fonts URLs for multi-script support
const FONT_URLS = {
  // Inter for Latin + Cyrillic (bold)
  interBold: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_0ew.woff",
  // Inter for Latin + Cyrillic (regular)
  interRegular: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_0ew.woff",
  // Noto Sans JP for Japanese (also covers some CJK)
  notoJP: "https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.woff",
  // Noto Sans SC for Simplified Chinese
  notoSC: "https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.woff",
  // Noto Sans KR for Korean
  notoKR: "https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLTq8H4hfeE.woff",
  // Noto Sans Arabic
  notoArabic: "https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyG2vu3CBFQLaig.woff",
  // Noto Sans Devanagari for Hindi
  notoDevanagari: "https://fonts.gstatic.com/s/notosansdevanagari/v25/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHjbL_08AlXQly-AzoFoW4Ow.woff",
};

async function loadFont(key: keyof typeof FONT_URLS): Promise<ArrayBuffer> {
  if (!fontCache[key]) {
    try {
      const response = await fetch(FONT_URLS[key]);
      if (response.ok) {
        fontCache[key] = await response.arrayBuffer();
      }
    } catch (e) {
      console.warn(`Failed to load font ${key}:`, e);
    }
  }
  return fontCache[key];
}

async function loadFonts() {
  // Load all fonts in parallel
  const [interBold, interRegular, notoJP, notoSC, notoKR, notoArabic, notoDevanagari] = await Promise.all([
    loadFont("interBold"),
    loadFont("interRegular"),
    loadFont("notoJP"),
    loadFont("notoSC"),
    loadFont("notoKR"),
    loadFont("notoArabic"),
    loadFont("notoDevanagari"),
  ]);

  return { interBold, interRegular, notoJP, notoSC, notoKR, notoArabic, notoDevanagari };
}

export interface OGImageOptions {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  accentColor?: string;
  /** Text direction: 'ltr' (default) or 'rtl' for Arabic */
  direction?: "ltr" | "rtl";
}

export async function generateOGImage(options: OGImageOptions): Promise<string> {
  const {
    title,
    subtitle = "Daily Market Signals for Crypto, Forex, Stocks",
    badge,
    badgeColor = "#22c55e",
    accentColor = "#00d9ff",
    direction = "ltr",
  } = options;

  const isRTL = direction === "rtl";

  const fonts = await loadFonts();

  // Build the element tree for satori
  const element = {
    type: "div",
    props: {
      style: {
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0f",
        padding: "60px",
        direction: isRTL ? "rtl" : "ltr",
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

  // Build font configuration with fallbacks for all scripts
  const fontConfig: Array<{ name: string; data: ArrayBuffer; weight: number; style: "normal" }> = [
    // Primary fonts (Latin + Cyrillic)
    { name: "Inter", data: fonts.interBold, weight: 700, style: "normal" },
    { name: "Inter", data: fonts.interRegular, weight: 400, style: "normal" },
  ];

  // Add CJK fonts if loaded (fallback fonts for non-Latin characters)
  if (fonts.notoJP) {
    fontConfig.push({ name: "Noto Sans JP", data: fonts.notoJP, weight: 400, style: "normal" });
  }
  if (fonts.notoSC) {
    fontConfig.push({ name: "Noto Sans SC", data: fonts.notoSC, weight: 400, style: "normal" });
  }
  if (fonts.notoKR) {
    fontConfig.push({ name: "Noto Sans KR", data: fonts.notoKR, weight: 400, style: "normal" });
  }
  if (fonts.notoArabic) {
    fontConfig.push({ name: "Noto Sans Arabic", data: fonts.notoArabic, weight: 400, style: "normal" });
  }
  if (fonts.notoDevanagari) {
    fontConfig.push({ name: "Noto Sans Devanagari", data: fonts.notoDevanagari, weight: 400, style: "normal" });
  }

  // Generate SVG using satori with multi-script font support
  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: fontConfig,
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
