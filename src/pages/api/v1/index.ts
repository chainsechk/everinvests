// src/pages/api/v1/index.ts
// API Documentation endpoint
import type { APIContext } from "astro";

export async function GET(_context: APIContext) {
  return Response.json(
    {
      name: "EverInvests API",
      version: "1.0",
      description: "Programmatic access to EverInvests market signals",
      baseUrl: "https://everinvests.com/api/v1",
      endpoints: {
        "GET /signals": {
          description: "Get latest signals for specified categories",
          parameters: {
            category: {
              type: "string",
              description: "Comma-separated categories: crypto, forex, stocks (default: all)",
              example: "crypto,forex",
            },
          },
          response: {
            version: "string",
            generatedAt: "ISO 8601 timestamp",
            macro: {
              overall: "Risk-on | Risk-off | Mixed",
              dxyBias: "Bullish | Bearish | Neutral",
              vixLevel: "Low | Elevated | High",
              fearGreed: "number (0-100)",
              btcDominance: "number (%)",
              yieldSpread: "number (%)",
            },
            signals: {
              "[category]": {
                bias: "Bullish | Bearish | Neutral",
                date: "YYYY-MM-DD",
                timeSlot: "HH:00",
                summary: "string",
                assets: [
                  {
                    ticker: "string",
                    bias: "Bullish | Bearish | Neutral",
                    price: "number",
                    ma20: "number",
                    vsMA20: "percentage string",
                  },
                ],
                url: "Signal detail URL",
              },
            },
          },
        },
        "GET /accuracy": {
          description: "Get accuracy statistics for a category",
          path: "/api/accuracy/:category",
        },
        "GET /stats": {
          description: "Get overall platform statistics",
          path: "/api/stats",
        },
      },
      rateLimits: {
        note: "No authentication required. Please limit to 60 requests per minute.",
      },
      alternativeAccess: {
        mcp: {
          description: "Model Context Protocol server for AI agents",
          url: "https://everinvests-mcp.duyuefeng0708.workers.dev/mcp",
        },
        rss: {
          description: "RSS feed for signal updates",
          url: "https://everinvests.com/rss.xml",
          categoryFeeds: {
            crypto: "https://everinvests.com/rss.xml?category=crypto",
            forex: "https://everinvests.com/rss.xml?category=forex",
            stocks: "https://everinvests.com/rss.xml?category=stocks",
          },
        },
        webhooks: {
          description: "Real-time push notifications (requires API key)",
          documentation: "Contact for access",
        },
      },
      links: {
        website: "https://everinvests.com",
        telegram: "https://t.me/everinvests",
        performance: "https://everinvests.com/performance",
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
