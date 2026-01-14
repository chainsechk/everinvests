import {
  type Category,
  type AssetSignal,
  type MacroSignal,
  type Bias,
  CRYPTO_ASSETS,
  FOREX_ASSETS,
  STOCK_ASSETS,
} from "./types";
import { fetchCryptoData, fetchForexData, fetchStockData, fetchMacroData } from "./data";
import {
  calculateAssetBias,
  calculateCategoryBias,
  calculateMacroSignal,
  extractLevels,
  identifyRisks,
  formatMacroForStorage,
} from "./signals";
import { generateSummary } from "./llm";
import { notifySignal } from "./notify";

export interface Env {
  DB: D1Database;
  AI: Ai;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OPENROUTER_API_KEY?: string;
  TWELVEDATA_API_KEY?: string;
  ALPHAVANTAGE_API_KEY?: string;
}

// Schedule configuration (UTC hours)
const SCHEDULE: Record<Category, { hours: number[]; weekdaysOnly: boolean }> = {
  crypto: { hours: [0, 8, 16], weekdaysOnly: false },
  forex: { hours: [0, 8, 14], weekdaysOnly: true },
  stocks: { hours: [17, 21], weekdaysOnly: true },
};

function getCategoriesToRun(utcHour: number, dayOfWeek: number): Category[] {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const categories: Category[] = [];

  for (const [category, config] of Object.entries(SCHEDULE) as [Category, typeof SCHEDULE[Category]][]) {
    if (config.hours.includes(utcHour)) {
      if (!config.weekdaysOnly || isWeekday) {
        categories.push(category);
      }
    }
  }

  return categories;
}

function formatTimeSlot(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runScheduledJob(env, event.cron));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    // Manual trigger (for testing)
    if (url.pathname === "/trigger") {
      const category = url.searchParams.get("category") as Category | null;
      await runScheduledJob(env, "manual", category ? [category] : undefined);
      return Response.json({ triggered: true, category: category ?? "all scheduled" });
    }

    return new Response("everinvests-worker", { status: 200 });
  },
};

async function runScheduledJob(
  env: Env,
  cron: string,
  forceCategories?: Category[]
): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  const date = now.toISOString().split("T")[0];
  const timeSlot = formatTimeSlot(utcHour);

  const categories = forceCategories ?? getCategoriesToRun(utcHour, dayOfWeek);

  if (categories.length === 0) {
    console.log(`[${cron}] No categories scheduled for hour ${utcHour}`);
    return;
  }

  console.log(`[${cron}] Running for categories: ${categories.join(", ")} at ${date} ${timeSlot}`);

  // Fetch macro data once (shared across categories)
  let macroSignal: MacroSignal;
  let macroId: number | null = null;

  if (env.ALPHAVANTAGE_API_KEY) {
    try {
      const macroData = await fetchMacroData(env.ALPHAVANTAGE_API_KEY);
      macroSignal = calculateMacroSignal(macroData);
      macroId = await saveMacroSignal(env.DB, date, timeSlot, macroSignal, macroData);
    } catch (error) {
      console.error("Macro data fetch failed:", error);
      macroSignal = { dxyBias: "neutral", vixLevel: "neutral", yieldsBias: "stable", overall: "Mixed" };
    }
  } else {
    console.log("No ALPHAVANTAGE_API_KEY, using default macro");
    macroSignal = { dxyBias: "neutral", vixLevel: "neutral", yieldsBias: "stable", overall: "Mixed" };
  }

  // Process each category
  for (const category of categories) {
    const runStartTime = Date.now();
    try {
      await processCategory(env, category, date, timeSlot, macroSignal, macroId);
      await logRun(env, category, timeSlot, "success", Date.now() - runStartTime);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${category}] Error: ${errorMsg}`);
      await logRun(env, category, timeSlot, "error", Date.now() - runStartTime, errorMsg);
    }
  }
}

async function processCategory(
  env: Env,
  category: Category,
  date: string,
  timeSlot: string,
  macroSignal: MacroSignal,
  macroId: number | null
): Promise<void> {
  console.log(`[${category}] Processing signals for ${date} ${timeSlot}`);

  // 1. Fetch asset data based on category
  const assetData = await fetchAssetData(env, category);

  if (assetData.length === 0) {
    throw new Error(`No asset data fetched for ${category}`);
  }

  console.log(`[${category}] Fetched ${assetData.length} assets`);

  // 2. Calculate bias for each asset
  const assetSignals: AssetSignal[] = assetData.map(data =>
    calculateAssetBias(data, category)
  );

  // 3. Calculate overall category bias
  const categoryBias = calculateCategoryBias(assetSignals);

  // 4. Extract levels and risks
  const levels = extractLevels(assetSignals, category);
  const risks = identifyRisks(assetSignals, category);

  // 5. Generate LLM summary
  const summary = await generateSummary(
    { category, bias: categoryBias, macro: macroSignal, assets: assetSignals, levels, risks },
    env.AI,
    env.OPENROUTER_API_KEY
  );

  console.log(`[${category}] Generated summary: ${summary}`);

  // 6. Save to database
  const signalId = await saveSignal(
    env.DB,
    category,
    date,
    timeSlot,
    categoryBias,
    macroId,
    assetData,
    { summary, levels, risks }
  );

  await saveAssetSignals(env.DB, signalId, assetSignals);

  console.log(`[${category}] Saved signal ID: ${signalId}`);

  // 7. Send Telegram notification
  const notified = await notifySignal(
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_CHAT_ID,
    category,
    categoryBias,
    summary,
    assetSignals,
    macroSignal,
    date,
    timeSlot
  );

  console.log(`[${category}] Telegram notification: ${notified ? "sent" : "skipped"}`);
}

async function fetchAssetData(env: Env, category: Category) {
  switch (category) {
    case "crypto":
      return fetchCryptoData(CRYPTO_ASSETS);
    case "forex":
      if (!env.TWELVEDATA_API_KEY) {
        throw new Error("TWELVEDATA_API_KEY not configured");
      }
      return fetchForexData(FOREX_ASSETS, env.TWELVEDATA_API_KEY);
    case "stocks":
      if (!env.TWELVEDATA_API_KEY) {
        throw new Error("TWELVEDATA_API_KEY not configured");
      }
      return fetchStockData(STOCK_ASSETS, env.TWELVEDATA_API_KEY);
  }
}

async function saveMacroSignal(
  db: D1Database,
  date: string,
  timeSlot: string,
  signal: MacroSignal,
  rawData: any
): Promise<number> {
  const formatted = formatMacroForStorage(signal);

  const result = await db.prepare(
    `INSERT INTO macro_signals (date, time_slot, generated_at, dxy_bias, vix_level, yields_bias, overall, data_json)
     VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)
     ON CONFLICT(date, time_slot) DO UPDATE SET
       generated_at = datetime('now'),
       dxy_bias = excluded.dxy_bias,
       vix_level = excluded.vix_level,
       yields_bias = excluded.yields_bias,
       overall = excluded.overall,
       data_json = excluded.data_json
     RETURNING id`
  )
    .bind(
      date,
      timeSlot,
      formatted.dxy_bias,
      formatted.vix_level,
      formatted.yields_bias,
      formatted.overall,
      JSON.stringify(rawData)
    )
    .first<{ id: number }>();

  return result?.id ?? 0;
}

async function saveSignal(
  db: D1Database,
  category: Category,
  date: string,
  timeSlot: string,
  bias: Bias,
  macroId: number | null,
  rawData: any,
  output: { summary: string; levels: Record<string, number>; risks: string[] }
): Promise<number> {
  const result = await db.prepare(
    `INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, data_json, output_json)
     VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)
     ON CONFLICT(category, date, time_slot) DO UPDATE SET
       generated_at = datetime('now'),
       bias = excluded.bias,
       macro_id = excluded.macro_id,
       data_json = excluded.data_json,
       output_json = excluded.output_json
     RETURNING id`
  )
    .bind(
      category,
      date,
      timeSlot,
      bias,
      macroId,
      JSON.stringify(rawData),
      JSON.stringify(output)
    )
    .first<{ id: number }>();

  return result?.id ?? 0;
}

async function saveAssetSignals(
  db: D1Database,
  signalId: number,
  assets: AssetSignal[]
): Promise<void> {
  // Delete existing asset signals for this signal
  await db.prepare("DELETE FROM asset_signals WHERE signal_id = ?").bind(signalId).run();

  // Insert new asset signals
  for (const asset of assets) {
    await db.prepare(
      `INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        signalId,
        asset.ticker,
        asset.bias,
        asset.price,
        asset.vsMA20,
        asset.secondaryInd,
        JSON.stringify({ reasoning: asset.reasoning })
      )
      .run();
  }
}

async function logRun(
  env: Env,
  category: Category,
  timeSlot: string,
  status: "success" | "error",
  durationMs: number,
  errorMsg?: string
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO run_logs (category, time_slot, run_at, status, duration_ms, error_msg)
       VALUES (?, ?, datetime('now'), ?, ?, ?)`
    )
      .bind(category, timeSlot, status, durationMs, errorMsg ?? null)
      .run();
  } catch (e) {
    console.error("Failed to log run:", e);
  }
}
