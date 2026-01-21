// src/pages/api/v1/signals.ts
// Structured API v1 - Consolidated signal endpoint for programmatic access
import type { APIContext } from "astro";

interface SignalRow {
  id: number;
  category: string;
  date: string;
  time_slot: string;
  bias: string;
  data_json: string | null;
  output_json: string | null;
}

interface AssetSignalRow {
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  data_json: string | null;
}

interface MacroRow {
  overall: string;
  dxy_bias: string;
  vix_level: string;
  data_json: string | null;
}

// GET /api/v1/signals?category=crypto,forex,stocks
// Returns consolidated signal data for specified categories
export async function GET(context: APIContext) {
  const db = context.locals.runtime?.env?.DB;

  if (!db) {
    return Response.json(
      { error: "database not configured", code: "DB_ERROR" },
      { status: 500 }
    );
  }

  const url = new URL(context.request.url);
  const categoriesParam = url.searchParams.get("category");
  const validCategories = ["crypto", "forex", "stocks"];

  // Parse categories (default to all)
  let categories: string[];
  if (categoriesParam) {
    categories = categoriesParam
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter((c) => validCategories.includes(c));

    if (categories.length === 0) {
      return Response.json(
        {
          error: "Invalid category. Valid options: crypto, forex, stocks",
          code: "INVALID_CATEGORY",
        },
        { status: 400 }
      );
    }
  } else {
    categories = validCategories;
  }

  try {
    // Fetch macro context
    const macro = await db
      .prepare(
        `SELECT overall, dxy_bias, vix_level, data_json
         FROM macro_signals
         ORDER BY date DESC, time_slot DESC
         LIMIT 1`
      )
      .first<MacroRow>();

    const macroData = macro?.data_json ? JSON.parse(macro.data_json) : {};

    // Fetch signals for each category
    const signals: Record<string, unknown> = {};

    for (const category of categories) {
      const signal = await db
        .prepare(
          `SELECT id, category, date, time_slot, bias, data_json, output_json
           FROM signals
           WHERE category = ?
           ORDER BY date DESC, time_slot DESC
           LIMIT 1`
        )
        .bind(category)
        .first<SignalRow>();

      if (signal) {
        const assets = await db
          .prepare(
            `SELECT ticker, bias, price, vs_20d_ma, data_json
             FROM asset_signals
             WHERE signal_id = ?`
          )
          .bind(signal.id)
          .all<AssetSignalRow>();

        const output = signal.output_json ? JSON.parse(signal.output_json) : {};
        const data = signal.data_json ? JSON.parse(signal.data_json) : {};

        signals[category] = {
          bias: signal.bias,
          date: signal.date,
          timeSlot: signal.time_slot,
          summary: output.summary || null,
          levels: output.levels,
          triggers: output.triggers,
          risks: output.risks,
          assets: (assets.results || []).map((a) => ({
            ticker: a.ticker,
            bias: a.bias,
            price: a.price,
            vsMA20: a.vs_20d_ma,
            ...(a.data_json ? JSON.parse(a.data_json) : {}),
          })),
          qualityFlags: data.qualityFlags || [],
          url: `https://everinvests.com/${category}/${signal.date}/${signal.time_slot}`,
        };
      }
    }

    return Response.json(
      {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        macro: macro
          ? {
              overall: macro.overall,
              dxyBias: macro.dxy_bias,
              vixLevel: macro.vix_level,
              fearGreed: macroData.fearGreed,
              btcDominance: macroData.btcDominance,
              yieldSpread: macroData.yieldSpread,
              gold: macroData.gold,
            }
          : null,
        signals,
        meta: {
          categories: categories,
          updateSchedule: {
            crypto: ["00:00", "08:00", "16:00"],
            forex: ["00:00", "08:00", "14:00"],
            stocks: ["17:00", "21:00"],
          },
          links: {
            website: "https://everinvests.com",
            rss: "https://everinvests.com/rss.xml",
            mcp: "https://everinvests-mcp.duyuefeng0708.workers.dev/mcp",
            telegram: "https://t.me/everinvests",
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // 5 min cache
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    console.error("API error:", e);
    return Response.json(
      { error: "Failed to fetch signals", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}
